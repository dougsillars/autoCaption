
const axios = require('axios');

let happyscribeKey = "LnPSRsx71QQNfpQ7dVvrKQtt";
let videoName = "testing script";
let language = "en-GB";
let mp4 = "https://cdn.api.video/vod/vi3C1bpk5ONBdQ2zesUOnzBJ/mp4/1080/source.mp4";
makeCaptionRequest(mp4,videoName,language )

async function makeCaptionRequest(mp4,videoName,language ) {



   const config = {
	 method: 'POST',
	   url: 'https://www.happyscribe.com/api/v1/transcriptions',
	   headers: { 
		   	authorization: 'Bearer ' + happyscribeKey,
    	   	'content-type': 'application/json'
		},
		data: JSON.stringify({
		   transcription: {
		        name: videoName,
		        language: language,
		        tmp_url: mp4
		      }
	  })
    }
	console.log("config" ,config);
	try {
		let apiResponse = await axios(config);
		let trascriptionId = apiResponse.id;
	   console.log(" trascriptionId", trascriptionId);
		//now we have requested a transcription, so we need to check to see if the transcription is ready
	   //so we will oping the checkTranscription endpoint  
		  
		  
	  } catch (error) {
		  console.log(error)
	  }

  }