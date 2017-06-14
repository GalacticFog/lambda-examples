var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');

function run(/* arguments, credentials */) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.2.0/js_lambda/gestalt-sdk.js');

    META = get_meta();
    log("found meta: " + META.url, LoggingLevels.DEBUG);

    var root_org = find_org("root");
    log("found root org:" + root_org.id + "\n", LoggingLevels.DEBUG);

    //locate the laser service for root
    var laser = list_providers(root_org, ProviderTypes.LAMBDA);
    if (laser.length == 0) {
        log("error: Could not find any Lambda providers");
        return getLog();
    }
    else laser = laser[0];

    //locate the gateway service for root
    var gateway = list_providers(root_org, ProviderTypes.GATEWAYMANAGER);
    if (gateway.length == 0) {
        log("error: Could not find any Gateway providers");
        return getLog();
    }
    else gateway = gateway[0];

    //now we setup and endpoint to expose the /results endpoint in the lambda service
    // - find the [SERVICE_HOST,SERVICE_PORT] for lambda
    // - construct the api/endpoint accordingly

    var lambdaCoords = getServiceCoordinates( laser );
    var resultsUrl = "http://" + lambdaCoords.host + ":" + lambdaCoords.port + "/results";
    log( "resultsUrl : " + resultsUrl );

    var gatewayCoords = getServiceCoordinates( gateway );
    var gatewayBase = "http://" + gatewayCoords.host + ":" + gatewayCoords.port;
    log( "gatewayBase : " + gatewayBase );

    //we really don't know which provider necessarily we're meant to use, so we'll just grab the first one
    var provider = m_GET(gatewayBase + "/providers")
    if (provider.length == 0) {
        log("error: Could not find any configured gateway providers in the gateway service");
        return getLog();
    }
    else provider = provider[0];

    //first check to see if there's already an API named results
    var checkApis = m_GET( gatewayBase + "/apis" );
    for each ( api in checkApis ) if( api.name == "results" ) {
        log( "error : /results api is already defined on this gateway" );
        return getLog();
    }

    var resultsApi = {
        name : "results",
        description : "Lambda Results endpoint",
        provider : {
            id : provider.id,
            location : provider.id
        }
    };

    //create the api and fetch the id of the created resource
    var api = m_POST( gatewayBase + "/apis", resultsApi );
    //returns a list, so just grab the first entry which is the api we're interested in
    api = api[0];

    var resultsEndpoint = {
        name : "lambda results",
        apiId : api.id,
        upstreamUrl : resultsUrl,
        path : "/"
    };

    //create the endpoint, and we're done
    var endpoint = m_POST( gatewayBase + "/apis/" + api.id + "/endpoints", resultsEndpoint );

    log( "created results endpoint for laser service : " + endpoint.url );
    return getLog();
}

function getServiceCoordinates( provider ) {
    log( "fetching provider coordinates : " + provider.name )
    return {
        host : provider.properties.config.env.public.SERVICE_HOST,
        port : provider.properties.config.env.public.SERVICE_PORT
    }
}

/*
 * REST utilities
 */

function m_handleResponse(response) {
    var code = response.getStatusCode();
    var body = response.getResponseBody();
    if (code == 404) {
        return null;
    } else if (code >= 300) {
        log("WARNING: status code " + code + " from " + response.getUri());
        log("response: " + body);
        throw code;
    } else if (code == 204) {
        return null;
    }
    if (response.getContentType().startsWith("application/json")) return JSON.parse(body);
    return body;
}

function m_REST_JSON(method, endpoint, payload, async, fResponse) {
    var pc = client.prepareConnect(endpoint)
        .setMethod(method)
        .addHeader("Authorization", META.creds);
    log(method + " " + endpoint, LoggingLevels.DEBUG);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    var _async = async ? async : false; // just being explicit that the default here is 'false'
    if (_async) {
        if (!fResponse) fResponse = new CompletableFuture();
        pc.execute(new org.asynchttpclient.AsyncCompletionHandler({
            onCompleted: function(response) {
                fResponse.complete(m_handleResponse(response));
            }
        }));
        return fResponse;
    }
    return m_handleResponse(pc.execute().get());
}

function m_DELETE(endpoint, async, fResponse) {
    return m_REST_JSON("DELETE", endpoint, null, async, fResponse);
}

function m_GET(endpoint, async, fResponse) {
    return m_REST_JSON("GET", endpoint, null, async, fResponse);
}

function m_POST(endpoint, payload, async, fResponse) {
    return m_REST_JSON("POST", endpoint, payload, async, fResponse);
}

function m_PUT(endpoint, payload, async, fResponse) {
    return m_REST_JSON("PUT", endpoint, payload, async, fResponse);
}

function m_PATCH(endpoint, payload, async, fResponse) {
    return m_REST_JSON("PATCH", endpoint, payload, async, fResponse);
}
