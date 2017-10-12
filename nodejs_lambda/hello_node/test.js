var exports = module.exports = {};
exports.hello = function(event, context) {
 
  var thing = JSON.parse(context);

	console.log("hello world");
	console.log("/n/n");
	console.log("context : ");
	console.log(" - method\t\t: " + thing.method );
	console.log(" - executionId\t\t: " + thing.executionId );
	console.log(" - lambdaId\t\t: " + thing.lambdaId );
	console.log(" - eventName\t\t: " + thing.eventName );
	console.log(" - creds\t\t: " + thing.creds );
	console.log(" - user\t\t\t: " + thing.user );
	console.log(" - params\t\t: " + thing.params );
	console.log(" - headers\t\t: " + thing.headers );

  console.log("/n/n");
  console.log("event : " + event );

  console.log("/n/n");
  console.log("environment : \n" )

  var env = process.env;
  for (var i in env) {
    console.log("\t" + i + "=" + env[i]);
  }

  var _ = require('lodash');
  var junkyArray = [ 1, 0, '', 4, 2, false, 8, null ];
  console.log( "here's a junky array : " + junkyArray );
  var betterArray = _.compact( junkyArray );
  console.log( "here's a cleaner array : " + betterArray );

	return "hello world.";
};

exports.goodbye = function goodbye(event, context) {

  console.log( "goodbye world" );
  _privateFunction( event, context );
  return "goodbye world.";
}

function _privateFunction( event, context) {

    console.log("PRIVATE FUNCTION CALLED");
    return "this is a private function.";
}
