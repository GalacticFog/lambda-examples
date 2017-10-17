var exports = module.exports = {};
exports.lodash = function(event, context, callback) {
 
  var _ = require('lodash');
  var junkyArray = [ 1, 0, '', 4, 2, false, 8, null ];
  var returnString = "here's a junky array : " + junkyArray + "\n";
  var betterArray = _.compact( junkyArray );
  returnString += "here's a cleaner array : " + betterArray + "\n";

	callback( null, returnString );
};
