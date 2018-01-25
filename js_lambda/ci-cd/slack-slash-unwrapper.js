var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');
var client = new AsyncHttpClient();

function _handleResponse(response) {
    var code = response.getStatusCode();
    var body = response.getResponseBody();
    if (code == 404) {
        return null;
    } else if (code >= 300) {
        console.log("WARNING: status code " + code + " from " + response.getUri());
        console.log("response: " + body);
        throw code;
    } else if (code == 204) {
        return null;
    }
    if (response.getContentType() && response.getContentType().startsWith("application/json")) return JSON.parse(body);
    return body;
}

function _REST_JSON(method, url, auth, payload, async, fResponse) {
    var pc = client.prepareConnect(url)
        .setMethod(method)
        .addHeader("Authorization", auth);
    console.log(method + " " + url);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    var _async = async ? async : false; // just being explicit that the default here is 'false'
    if (_async) {
        if (!fResponse) fResponse = new CompletableFuture();
        pc.execute(new org.asynchttpclient.AsyncCompletionHandler({
            onCompleted: function(response) {
                fResponse.complete(_handleResponse(response));
            }
        }));
        return fResponse;
    }
    return _handleResponse(pc.execute().get());
}

function _get_env(key) {
    var val = java.lang.System.getenv().get(key);
    if (val) return val;
    if (def) return def;
    throw "Env missing variable " + key;
}

function run(args, ctx) {
    slack_token  = _get_env("SLACK_TOKEN");
    upstream_url = _get_env("UPSTREAM_URL");
    auth = _get_env("AUTH_HEADER");
    console.log("args: " + args);

    arrargs = args.split("&");
    var payload = {};
    for each (a in arrargs) {
        split = a.split("=");
        payload[split[0]] = decodeURIComponent(split[1]);
    }
    console.log(JSON.stringify(payload));

    if (payload.ssl_check === "1") return JSON.stringify({
        text: 'thanks for checking'
    });

    if (payload.token != slack_token) return JSON.stringify({
        reponse_type: "in_channel",
        attachments: [
            {
                pretext: "You Shall Not Pass",
                image_url: "https://media.giphy.com/media/XibrkP29RzpTO/giphy.gif"
            }
        ]
    });

    try {
        resp = _REST_JSON("POST", upstream_url, auth, payload);
        console.log(JSON.stringify(resp));
    } catch (err) {
        return JSON.stringify({
            response_type: "ephemeral",
            text: "Error invoking lambda"
        });
    }

    username = payload.user_name || "the nameless one";
    return JSON.stringify({
        response_type: "ephemeral",
        text: "Requesting schema check on behalf of " + username
    });
}