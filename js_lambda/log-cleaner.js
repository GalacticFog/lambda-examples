var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');

function run(/* arguments, credentials */) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.2.0/js_lambda/gestalt-sdk.js');

    var logUrl = get_env( "LOG_URL" );

    var pc = client.prepareConnect(logUrl)
        .setMethod("GET");

    pc.execute(new org.asynchttpclient.AsyncCompletionHandler({
        onCompleted: function(response) {
            log("respnse : " + response );
        }
    }));

    log( "invoked lambda clean...");
    return getLog();
}
