var exports = module.exports = {};
exports.aws = function(event, context) {

  var creds = {};
  if( event ) {
    var parsedEvent = JSON.parse( event ); 
    creds = parsedEvent.creds
  }

  var _ = require("lodash");
  var AWS = require('aws-sdk');

  if( creds ) {
    AWS.config = creds;
  }

  var route53 = new AWS.Route53();

  var params = {};
  route53.listHostedZonesByName( params, function(err, data) {
    if( err ) console.log( err, err.stack );
    else {
        _.forEach( data.HostedZones, function(item) {
            console.log( "(id,name) - (" + item.Id + "," + item.Name + ")");
        });

        var zoneId = data.HostedZones[0].Id

        var recordsParams = { HostedZoneId: zoneId };
        route53.listResourceRecordSets( recordsParams, function(err, data) {
                if( err ) console.log( err, err.stack );
                else {
                console.log( "records : " );
                _.forEach( data.ResourceRecordSets, function(record) {
                        console.log( " - " + record.Name + "," + record.Type ); 
                });
                }
        });
        }
  });
 
	return "thing";
};
