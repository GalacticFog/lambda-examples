function run(event, context) {

	// Call the console.log function.
	console.log("Sendint text...");
	console.log("event : " + event );
	console.log("context : " + context );
	var eventData = JSON.parse( event );

	var pathEnvironment = eventData.service_path;
	console.log( "pathEnvironment : " + pathEnvironment );

	var u = "https://hooks.slack.com/services/" + pathEnvironment;


	var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
	var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');
	var client = new AsyncHttpClient();

	var message = "Hello Lambda App!";
	if ( eventData.text ) {
		message = eventData.text;
	}

  var payload = '{ "text" : "' + message + '"}';

	var pc = client.preparePost(u).setBody( payload )

	var resp = _handleResponse(pc.execute().get());
	console.log( resp );

	console.log("\nSending 'POST' request to URL : " + u);

	return "SUCCESS";
};

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
	if (response.getContentType().startsWith("application/json")) return JSON.parse(body);
	return body;
}
