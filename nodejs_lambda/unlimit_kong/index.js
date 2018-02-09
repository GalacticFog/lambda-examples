var exports = module.exports = {};
exports.fix = function(context, data, callback) {

var protocol = 'http:';
var querystring = require('querystring');

var http = require('http');

var kongHost = process.env.KONG_HOST;
var kongPort = process.env.KONG_PORT;

console.log( "host : " + kongHost );

var options = {
    protocol: protocol,
    host: kongHost,
    port: kongPort,
    json : true,
    path: '/plugins',
    method: 'GET',
    headers: {
				'Accept' : 'application/json'
    }
};

var req = http.request(options, function(res) {
    res.setEncoding('utf8');

    var body = '';
		res.on('data', function(chunk){
        body += chunk;
    });

    res.on('end', function(){
        var plugins = JSON.parse(body);
				var pluginData = plugins.data;
				for( var i = 0; i < pluginData.length; i++ ) {
					var id = pluginData[i].id;
					console.log( "plugin id : " + id );
					if( !pluginData[i].hasOwnProperty( "api_id" ) ) {
						if( pluginData[i].name == "rate-limiting" ) {
							console.log( "found global rate limiting plugin...deleting" );
							
							var options2 = {
								protocol: protocol,
								host: kongHost,
								port: kongPort,
								path: '/plugins/' + id,
                json : true,
								method: 'DELETE',
								headers: {
								}
						 };

						 var req2 = http.request(options2, function(res2) {
    						res2.setEncoding('utf8');

    						res2.on('data', function(chunk){
									console.log( "done" );
									callback( null, chunk );
    						});
						}).on('error', function(e) {
  						console.log("Got error: " + e.message);
  					});;
						req2.write( data );
						req2.end();
						
					}
					
				}

    }});

}).on('error', function(e) {
  console.log("Got error: " + e.message);
  });;

req.write(data);
req.end();
}
