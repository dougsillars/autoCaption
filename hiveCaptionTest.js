let hiveCaptionKey = "";

let mp4 = "https://cdn.api.video/vod/vi3C1bpk5ONBdQ2zesUOnzBJ/mp4/1080/source.mp4";



var request = require("request");

var options = {
  method: 'POST',
  url: 'https://api.thehive.ai/api/v2/task/sync',
  headers: {
    accept: 'application/json',
    authorization: 'token ' + hiveCaptionKey
  },
  form: {image_url:mp4}
};  
console.log(options);	
request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
