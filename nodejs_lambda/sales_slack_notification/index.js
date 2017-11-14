var exports = module.exports = {};
exports.run = function (event, context, callback) {
  // let's do this is es6 style
  const axios = require("axios");
  const host = process.env.SLACK_API_BASEPATH;
  const path = process.env.SLACK_PATH;

  const slackAPI = axios.create({
    baseURL: host,
    headers: { 'Content-Type': 'application/json' }
  });

  const postMessage = async (path) => {
    try {
      const eventData = JSON.parse(event);
      const message = eventData && eventData.data.payload || 'a payload was not provided to the message';
      const body = { text: message };

      const response = await slackAPI.post(path, body);
      callback(null, 'SUCCESS');
    } catch (err) {
      callback(err, 'ERROR');
    }
  }
  
  postMessage(path);

};
