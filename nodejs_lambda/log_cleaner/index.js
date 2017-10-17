var exports = module.exports = {};

var request = require('request');
var rp = require('request-promise-native');
var moment = require('moment');

exports.clean = function( event, context, callback ) {

    var data = {};
	  if( event ) {
			date = JSON.parse( event );
		}

		const esUrl = getParameter( "esUrl", data );
    var options = {
			uri: esUrl + "/_cat/indices",
		 	json: true 
		};

    rp( options ).then( function(indices) {
       indices.forEach( function(entry)  {

				const indexName = entry.index;
				console.log( "index : " + indexName );

				const match = indexName.match( new RegExp('\\d{4}-\\d{2}-\\d{2}$'));
				if( match ) {

					const date = match[0];
					console.log( "date : " + date );

					const logDate = moment( date );
				  const todayDate = moment();
					const daysOld = Math.abs( logDate.diff( todayDate, 'days' ) );
					
					console.log( indexName + " - " + daysOld );
					
					const dateTolerance = getParameter( "age", data );
					if( daysOld >= dateTolerance ) {
						var deleteOpts = {
    					method: 'DELETE',
    					uri: esUrl + "/" + indexName
						};

						console.log( "deleting " + indexName );
						rp( deleteOpts ).then( function(result) {
										console.log( "successfully deleted " + indexName + " : " + result );
						});
					}
				}
			 }); 
    
      callback( null, "Successfully cleaned old indices" );
    })

    console.log( "bottom of func" );
};

function getParameter( paramName, json ) {
    console.log( "getting parameter " + paramName );
    if( json[paramName] ) return json[paramName];
    else return process.env[paramName];
}
