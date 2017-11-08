var exports = module.exports = {};
exports.token = function(context, data, callback) {

var protocol = 'http:';
var querystring = require('querystring');

var http = null;
if( process.env.SECURITY_PROTOCOL ) {
    if( process.env.SECURITY_PROTOCOL == 'http' ) {
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

var securityHost = process.env.SECURITY_HOST;
var securityPort = process.env.SECURITY_PORT;
var username = process.env.SECURITY_USERNAME;
var password = process.env.SECURITY_PASSPHRASE;

console.log( "protocol : " + protocol );
console.log( "host : " + securityHost );
console.log( "port : " + securityPort );
console.log( "user : " + username );
console.log( "pass : " + password );

var data = querystring.stringify({
      username: username,
      password: password,
			grant_type: "password"
    });

console.log( "data : " + data );

var options = {
    protocol: protocol,
    host: securityHost,
    port: securityPort,
    path: '/root/oauth/issue',
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
