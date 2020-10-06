require('dotenv').config();
//import express from 'express';
const express = require('express');
//express for the website and pug to create the pages
const app = express();
const pug = require('pug');
const path = require('path');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine','pug');
app.use(express.static('public'));
//favicons are the cool little icon in the browser tab
var favicon = require('serve-favicon');
app.use(favicon('public/icon.ico')); 
const axios = require('axios');
var request = require("request");

//to get and save and resubmit the VTT file
const http = require('http');
const fs = require('fs');

let hive=true;

//apivideo
const apiVideo = require('@api.video/nodejs-sdk');


//api keys  process.env.invoiceToken;
const apiVideoKey = process.env.apiKey;
const happyscribeKey = process.env.happyscribeKey;
const hiveCaptionKey =  process.env.hiveKey;
// website demo
//get request is the initial request - load the HTML page with the form
app.get('/', (req, res) => {
		res.sendFile(path.join(__dirname, '../public', 'indexChunks.html'));  
});

app.post('/', (req, res) => {
	
	//get values from POST body
	let videoId=req.body.videoId;
	let captions=req.body.captions;
	let videoName = req.body.videoName;
	let language = req.body.language;
	let captionsTag;
	console.log(language);
	//captionsTag will change as we move through process
	//captionsRequested
	//notCaptioned
	//captioned
	if(captions){
		captionsTag = "captionsRequested";
	}else{
		captionsTag = "notCaptioned";
	}
	//now - let's update the video with the captions, name (and any others)
	//console.log(apiVideoKey);
//	console.log(videoId, captions, videoName);
	client = new apiVideo.Client({ apiKey: apiVideoKey});
	
	

	let result = client.videos.update(videoId, {	title: videoName, 
												tags: [captionsTag]
											});
											console.log(result);
	result.then(function(video) {
		console.log("video uploaded and renamed");
		//video name changed.  
		//now begin process of captioning the video
		//
		// the MP$ link can take longer to 
			//get video player
			let player = video.assets.player;
			let m3u8 = video.assets.hls;
			let mp4url="";
			//no mp4 url until it is encoded.
			//let mp4Url = video.assets.mp4;
		
			//the checkMp4 fucntion will poll the status until the mp4 url is encoded.
			checkMp4(videoId, mp4url, videoName, language);
			
		    var iframecode = "iframe id='videoPlayer', src='"+player+"#autoplay', height='100%', width='100%'";
			//not ready to send to the 
			return res.render('result',{videoId, captions, videoName,player, iframecode});
	}).catch((error) => {
	    console.log(error);
	});
	
	

});


//testing on 3001
app.listen(3001, () =>
  console.log('Example app listening on port 3001!'),
);
process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log(err)
    // Note: after client disconnect, the subprocess will cause an Error EPIPE, which can only be caught this way.
});

function checkMp4(videoId, mp4, videoName, language) {
	console.log("checking mp4 encoding status");
	let status = client.videos.getStatus(videoId);
    status.then(function(videoStats){
	 // console.log(videoStats);
	  let playable = videoStats.encoding.playable;
	  let qualitylist = videoStats.encoding.qualities;
	  console.log("is video playable?", playable);
	  //only look for the mp4 if the video is playable
	  //when still encoding, sometimes the mp4 status does not appear immediately
	  if(playable){
		 console.log("video is playable");
	    for(let i=0; i<qualitylist.length; i++){
		  if(qualitylist[i].type == "mp4"){
			  //mp4
			  console.log("mp4 encoding status: ",qualitylist[i].status);
			  
			  if(qualitylist[i].status == "encoded"){
			  	//the video is ready - call the apivideo status API for the mp4 url
				  
				  let getmp4Url = client.videos.update(videoId, {	title: videoName});
											console.log(getmp4Url);
				getmp4Url.then(function(video) {
					mp4 = video.assets.mp4;
					console.log("got the mp4url", mp4);
				 	 //now we have the mp4 url, we can 
				 	 //we can call the API for captions
					makeCaptionRequest(mp4,videoName, videoId, language);
				}).catch((error) => {
	    			console.log(error);
				});
			  }else{
			  	//not encoded yet, wait 2 sec and re-reun checkMp4
				setTimeout(checkMp4,2000,videoId, mp4, videoName, language);
			  }
		  }
	    }
	  }else{
	  	setTimeout(checkMp4,2000,videoId, mp4, videoName, language);
	  }
  }).catch((error) => {
	    console.log(error);
	});
	
	
	
	
}

async function makeCaptionRequest(mp4,videoName, videoId, language){
	console.log("requesting captions");
	
	if(hive){
	
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
	 	   //we have each word, so we need to parse into sentences
	  	  //then the VTT we create can be uploaded to apivideo
	 	   parseHiveCaptions(body, videoId, language);
		});	
	}
	else{
		//Happyscribe
	    const config = {
	 	 method: 'POST',
	 	   url: 'https://www.happyscribe.com/api/v1/transcriptions',
	 	   headers: { 
	 		   	authorization: 'Bearer ' + happyscribeKey,
	     	   	'content-type': 'application/json',
			   accept: 'application/json'
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
	 		let transcriptionId = apiResponse.data.id;
			
			console.log(" apiResponse", apiResponse);
	 	   console.log("transcriptionId", transcriptionId);
	 		//now we have requested a transcription, so we need to check to see if the transcription is ready
	 	   //so we will oping the checkTranscription endpoint  
	 	   checkTranscription(transcriptionId);
		  
	 	  } catch (error) {
	 		  console.log(error)
	 	  }
		
	}
}

function parseHiveCaptions(body, videoId, language){
	//body has the response
	  let VTT = "";
	  let counter = 1;
	  let vttCounter =1;
	  let phraseCounter = 0;
	  let startTime = "00:00:00";
	  let endTime = "00:00:00";
	  let phrase = "";
	  let phraseLength =10;
	  let endOfPhrase= false;
	  let bodyJson = JSON.parse(body);
	  console.log("id", bodyJson.id);
	  //console.log()

	console.log("full transcript: "+JSON.stringify(bodyJson.status[0].response.output[0].transcript)+"\n");
	//let words = JSON.stringify(results[0].alternatives[0].words[0].startTime.seconds);
	//console.log("words" + words + results[0].alternatives[0].words.length);
 

	console.log("WEBVTT");
	VTT = VTT.concat("WEBVTT\n");

	  //for each tracnscript
	  for(var i=0; i<bodyJson.status[0].response.output[0].words.length;i++){	
		   //assume not end of sentecnce
	   
		   endOfPhrase= false;
	   
	   
		    //get the start time
		    let start = (bodyJson.status[0].response.output[0].words[i].time);
			let type = bodyJson.status[0].response.output[0].words[i].type;
		    //get the word
		    let word = (bodyJson.status[0].response.output[0].words[i].alternatives[0].text);		
		    //remove the quotes
			//word = word.slice(1, word.length - 1)
			//console.log(word);
			//does word start with punctuation?
		
		
		
			//the sentence either emds with punctuation or endOfPhrase words. 
			if (type == "punctuation"){
				//this is the end of a sentencet
				endOfPhrase= true;
			}
			if(counter % phraseLength == 0){
				//also the end of a sentence
				endOfPhrase= true;
			}
		
		
			//build the phrase
		
			//beginning of sentence
			if (counter % phraseLength == 1){
				//first entry in the phrase
				startTime = secondsToFormat(start);
				phrase = word;
				//console.log(counter + phrase);
			}
		
			//emd of sentence
			else if (endOfPhrase){
				//end of entry	
				if(type == "punctuation"){
					//dont add a space
					phrase  = phrase.concat(word);
				}else{
					//a real word, add a space
					phrase  = phrase.concat(" ", word);
				}
				endTime = secondsToFormat(start+2) ;
				//write the VTT to console
			//	console.log("");
				VTT = VTT.concat("\n");
			//	console.log(vttCounter);
				VTT = VTT.concat(vttCounter+ "\n");
				vttCounter++;
			//	console.log(startTime + " --> " +endTime);
				VTT = VTT.concat(startTime + " --> " +endTime +"\n");
			//	console.log(phrase);
				VTT = VTT.concat(phrase +"\n");
				counter =phraseLength;
			}
			//middle of sentence
			else if (counter % phraseLength > 1){
				//add a word to phrase
				phrase  = phrase.concat(" "+ word);
				//console.log(counter + phrase);
			}

			counter++;
		}	
	 //VTT created
		console.log("\n\n\n\n");
		console.log(VTT);
		let filename = videoId + ".VTT";
		//write VTT to file, and then send the file to api.video.
		fs.writeFile(filename, VTT, function(err) {
		    if(err) {
		        return console.log(err);
		    }
		    console.log("The file was saved!");
			updateCaptions(videoId, language, filename)
		});
		
	}
	
	function updateCaptions(videoId, language, filename){
		
		
		let result = client.captions.upload(filename, {videoId: videoId, language: language});

		 result.then(function(caption) {
		   console.log(caption.src);
			//caption added
			//make it default
			let updateDefault = client.captions.updateDefault(videoId, language, true);

		 		updateDefault.then(function(caption) {
			  		console.log(caption.default);
					//finally - change the tag to having a caption
					let updatecaption = client.videos.update(videoId, {tags: ["Captioned"]});

					 updatecaption.then(function(video) {
					   console.log(video.description);
					 });
				}).catch((error) => {
    					console.log(error);
			
				});
		   
		}).catch((error) => {
    		console.log(error);
			
		});
		
	}

	function secondsToFormat(seconds){
		let timeHours = Math.floor(seconds/3600).toString().padStart(2,'0');
		let timeMinutes = Math.floor(seconds/60).toString().padStart(2,'0');
		let timeSeconds = Math.floor(seconds % 60).toString().padStart(2,'0');
		let timeMilliseconds = Math.floor((seconds % 1)*1000).toString().padStart(3,'0');
	
		let formattedTime = timeHours+":"+timeMinutes+":"+timeSeconds+"."+timeMilliseconds;
		return formattedTime;
	}	
	
	
	async  function checkTranscription(transcriptionId){
	      const config2 = {
	   	 method: 'POST',
	   	   url: 'https://www.happyscribe.com/api/v1/transcriptions/'+ transcriptionId,
	   	   headers: { 
	   		   	authorization: 'Bearer ' + happyscribeKey,
	       	   	'content-type': 'application/json',
			     accept: 'application/json'
	   		}
	       }
	   	console.log("config" ,config2);
	   	try {
	   		let transcriptStatus = await axios(config2);
	   		let transcriptionStatus = transcriptStatus.state;
	   	   console.log("transcriptionStatus", transcriptionStatus);
		   if (transcriptionStatus == "automatic_done"){
		   		//transcription comploeted
			   //now we need to request the API create a VTT file
			   requestVTT(transcriptionId);
		   }
		   else{
		   	   //still underwaqy - so let's do it again!
			   setTimeout(checkTranscription,2000,transcriptionId);
		
		   }		  
	   	  } catch (error) {
	   		  console.log(error)
	   	  }
	  }  
 
	 async function requestVTT(transcriptionId){
	  	  // we have a valid transcription, 
		  // the trasncription has completed
		  // now we ask for the VTT file
	      const config3 = {
	   	   method: 'POST',
	   	   url: 'https://www.happyscribe.com/api/v1/exports',
	   	   headers: { 
	   		   	authorization: 'Bearer ' + happyscribeKey,
	       	   	'content-type': 'application/json'
	   		},
			data: JSON.stringify({
			   transcription: {
				   format: 'VTT',
				   transcriptionIds: [transcriptionId]
			      }
		    })
	       }
	   	console.log("config" ,config3);
	   	try {
	   		let exportResponse = await axios(config3);
	   		let exportStatus = exportResponse.state;
	   	   console.log("exportStatus", exportStatus);
		   if (exportStatus == "ready"){
		   		//export is ready.. now we can download the file
			   // and upload it to api.video
			   let exportUrl = exportResponse.download_link;
		   
			   let filename = transcriptionId + ".VTT";
			   const file = fs.createWriteStream(filename);
			   const request = http.get(exportUrl, function(response) {
			     response.pipe(file);
			   });
		   
			   //now send this file to API.video
			   let uploadingCaption = client.captions.upload(path.join(__dirname +file) , {videoId: videoId, language: language});


	//a lot of ctach work to be done here.

			    uploadingCaption.then(function(caption) {
			      console.log(caption);
				  //set this caption as default
				  let setDefault = client.captions.updateDefault(videoId, language, true);

				   setDefault.then(function(captiondefault) {
				     console.log(captiondefault);
					 //finally. retag the video as having captions
					 captionsTag = "captioned";
					 let updatecaptionTag = client.videos.update(videoId, {tags: [captionsTag]});

					  updatecaptionTag.then(function(video) {
					    console.log(video.description);
					  });
				  });
			   });
		   
			   //todo
		   
		   }
		   else{
		   	   //still underwaqy - so let's do it again!
			   setTimeout(requestVTT,2000,transcriptionId);
		
		   }		  
	   	  } catch (error) {
	   		  console.log(error)
	   	  }
	
	  }	
	
	