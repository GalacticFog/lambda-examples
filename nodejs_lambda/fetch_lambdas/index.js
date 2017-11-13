var exports = module.exports = {}
exports.list = function( event, context, callback ) {

    var request = require('request');
    var rp = require('request-promise-native');

    var data = {};
    if( event ) {
        data = JSON.parse( event );
    }

    const securityProtocol = getParameter( "security_protocol", data );
    const securityHost = getParameter( "security_host", data );
    const securityPort = getParameter( "security_port", data );
    const securityUser = getParameter( "security_username", data );
    const securityPass = getParameter( "security_passphrase", data );

    const metaProtocol = getParameter( "meta_protocol", data );
    const metaHost = getParameter( "meta_host", data );
    const metaPort = getParameter( "meta_port", data );
    const metaFQON = getParameter( "meta_fqon", data );
    const metaEnvironment = getParameter( "meta_environment", data );

    const securityUrl = securityProtocol + "://" + securityHost + ":" + securityPort + "/root/oauth/issue";

    var options = {
        uri: securityUrl,
        form : {
            username: securityUser,
            password: securityPass,
            grant_type: "password"
        },
        method : "POST",
        json: true
    };

    var token = "";
    var metaUrl = metaProtocol + "://" + metaHost + ":" + metaPort + "/" + metaFQON + "/environments/" + metaEnvironment + "/lambdas";

    rp( options ).then( function(parsedBody) {

        token = parsedBody.access_token;
        console.log( "token : " + token );

        var rp2 = {
            uri: metaUrl,
            method : "GET",
            headers : {
                Authorization : "Bearer " + token
            },
            json: true
        };

        return rp( rp2 );

    }).then( function( parsedResponse ) {
        console.log( parsedResponse );
        const lambdas = JSON.stringify( parsedResponse );
        callback( null, lambdas );
    });
};

 function getParameter( paramName, json ) {
     console.log( "getting parameter " + paramName );
     if( json[paramName] ) return json[paramName];
     else return process.env[paramName];
 }
