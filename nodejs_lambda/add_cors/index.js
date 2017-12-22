var exports = module.exports = {};
exports.cors = function(context, data, callback) {

var protocol = 'http:';
var querystring = require('querystring');

var http = null;
if( process.env.PROTOCOL ) {
    if( process.env.PROTOCOL == 'http' ) {
        http = require('http');
    }
    else {
        http = require('https');
        protocol = 'https:';
    }
}
else {
    http = require('http');
}

var kongHost = process.env.HOST;
var kongPort = process.env.PORT;

console.log( "protocol : " + protocol );
console.log( "host : " + kongHost );
console.log( "port : " + kongPort );

var data = querystring.stringify({
      "name": "cors",
      "config.origins": "*",
			"config.methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
      "config.headers": "Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Auth-Token"
    });

console.log( "data : " + data );

var options = {
    protocol: protocol,
    host: kongHost,
    port: kongPort,
    path: '/plugins',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
    }
};

var req = http.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        console.log("body: " + chunk);
        callback( null, chunk );
    });
}).on('error', function(e) {
  console.log("Got error: " + e.message);
  });;

req.write(data);
req.end();
}
