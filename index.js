import 'dotenv/config';
import express from 'express';
const app = express();
const pug = require('pug');
var server = require('http').createServer(app);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine','pug');
app.use(express.static('public'));
//favicons are the cool little icon in the browser tab
var favicon = require('serve-favicon');
app.use(favicon('public/icon.ico')); 
//formidable takes the form data and saves the file, and parameterises the fields into JSON
const formidable = require('formidable')
//file system - we need this to delete files after they are uploaded.
var fs = require('fs');
//apivideo
const apiVideo = require('@api.video/nodejs-sdk');


app.get('/', (req, res) => {
	res.sendFile("public/indexChunks.html");
}