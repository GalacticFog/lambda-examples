function run(event, context) {

	// Call the console.log function.
	console.log("Sendint text...");
	console.log("event : " + event );
	console.log("context : " + context );
	var eventData = JSON.parse( event );

	//add auth
	var userpass = eventData.accountKey + ":" + eventData.accountSecret;
	console.log( "USER:PASS : " + userpass );
	var basicAuth = "Basic " + new String(java.util.Base64.getEncoder().encodeToString(userpass.getBytes()));
	console.log( "AUTH : " + basicAuth );

	var u = "https://api.twilio.com/2010-04-01/Accounts/" + eventData.accountSid + "/Messages/?To=%2B" + eventData.to + "&From=%2B" + eventData.from;


	var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
	var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');
	var client = new AsyncHttpClient();
	var pc = client.preparePost(u)
		.addHeader("Authorization", basicAuth)
		.addFormParam("To", eventData.to)
		.addFormParam("From", eventData.from)
		.addFormParam("Body", eventData.body)

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
