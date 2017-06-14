var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');

function run(/* arguments, credentials */) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.2.0/js_lambda/gestalt-sdk.js');

    META = get_meta();
    log("found meta: " + META.url, LoggingLevels.DEBUG);

    var rootOrg = find_org("root");
    log("found root org:" + rootOrg.id + "\n", LoggingLevels.DEBUG);

    //locate the laser service for root
    var laser = list_providers(rootOrg, ProviderTypes.LAMBDA);
    if (laser.length == 0) {
        log("error: Could not find any Lambda providers");
        return getLog();
    }
    else laser = laser[0];

    exposeResults( laser, rootOrg );
    logMaintenance( laser, rootOrg );

    return getLog();
}

function logMaintenance( laser, rootOrg ) {
    log( "adding a log cleanup lambda" );

    //TODO : update the SDK with this type
    var logProviders = list_providers(rootOrg, "Logging");
    if (logProviders.length == 0) {
        log("error: Could not find any Lambda providers");
        return getLog();
    }

    //we either need a system fqon and environment, or else we need to create one
    var fqon = get_env( "SYSTEM_FQON", "root" );
    var systemOrg = find_org( fqon );
    var systemWorkspace = find_workspace_by_name( systemOrg, "gestalt-system" );
    if( systemWorkspace == null ) {
        systemWorkspace = create_workspace( systemOrg, "gestalt-system", "gestalt-system" );
    }

    var systemEnvironment = find_environment_by_name( systemOrg, "gestalt-system" );
    if( systemEnvironment == null ) {
        systemEnvironment = create_environment( systemOrg, systemWorkspace, "gestalt-system", "gestalt-system", EnvironmentTypes.PRODUCTION );
    }

    for each( provider in logProviders ) {
        var logCoordinates = getServiceCoordinates( provider );
        var logUrl = "http://" + logCoordinates.host + ":" + logCoordinates.port + "/clean";
        var lambdaName = provider.name + "-cleaner";
        var lambdaPayload = createCleanerLambda( laser, logUrl, lambdaName );
        var lambda = find_lambda_by_name( systemOrg, lambdaName );
        if( lambda == null ) {
            log( "creating lambda : " + lambdaName );
            lambda = create_lambda( systemOrg, systemEnvironment, lambdaPayload );
        }
    }
}

function find_lambda_by_name( parent_org, name, async ) {
    return find_meta_thing_by_name( parent_org, name, "lambdas", async );
}

function find_workspace_by_name( parent_org, name, async ) {
    return find_meta_thing_by_name( parent_org, name, "workspaces", async );
}

function find_environment_by_name( parent_org, name, async ) {
    return find_meta_thing_by_name( parent_org, name, "environments", async );
}

function find_meta_thing_by_name(parent_org, name, meta_thing, async) {
    var things = _GET("/" + fqon(parent_org) + "/" + meta_thing, async);
    for each( thing in things ) {
        if( thing.name == name ) {
            return thing;
        }
    }

    return null;
}

function exposeResults( laser, rootOrg ) {
    log( "exposing results endpoint..." )

    //locate the gateway service for root
    var gateway = list_providers(rootOrg, ProviderTypes.GATEWAYMANAGER);
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

function createCleanerLambda( laser, logUrl, name ) {

    var lambda = {
        name: name,
        description: name,
        properties: {
            code: "ZnVuY3Rpb24gcnVuKCkgewogICAgcmV0dXJuICJIZWxsbyBXb3JsZCI7Cn0=",
            code_type: "code",
            cpus: 0.1,
            env: {
                LOG_URL: logUrl
            },
            handler: "run",
            headers: {
                "Accept": "text/plain"
            },
            periodic_info: {
                payload: {
                    eventName: "test",
                    data: {
                        eventName: "no matter",
                        data: {}
                    }
                },
                schedule: "R-1/2017-02-07T02:0:00Z/PT1D",
                timezone: "Africa/Accra"
            },
            memory: 512,
            provider: {
                "id": laser.id,
                "locations": []
            },
            public: true,
            runtime: "nodejs",
            timeout: 30
        }
    };

    return lambda;
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
