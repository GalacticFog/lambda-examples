function hello(event, context) {

  load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.2.0/js_lambda/gestalt-sdk.js');

  var thing = JSON.parse(context);

	log("hello world");
	log("/n/n");
	log("context : ");
	log(" - method 			: " + thing.method );
	log(" - executionId : " + thing.executionId );
	log(" - params 			: " + thing.params );
	log(" - creds 			: " + thing.creds );

  log("/n/n");
  log("event : " + event );

	return getLog();
};

function goodbye(event, context) {
	console.log( "goodbye world" );
	return "bye";
}
