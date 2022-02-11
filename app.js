const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv').config();
const db = require("./db_manager.js");
const auth = require("./auth.js");
const { json } = require('express');

const credentials = {
	key: fs.readFileSync('/etc/letsencrypt/live/soralei.com/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/soralei.com/fullchain.pem')
};

const httpPort = 80;
const httpsPort = 443;

const app = express();

http.createServer(app).listen(httpPort, () => { console.log(`HTTP server listening on port ${httpPort}`); });
https.createServer(credentials, app).listen(httpsPort, () => { console.log(`HTTP server listening on port ${httpsPort}`) });

app.get('/', (req, res) => {

	if(!req.secure){
		return res.redirect("https://" + req.headers.host + req.url);
	}

	if(req.subdomains[0] != null && req.subdomains[0] == "dev"){
		return res.json({success: true, isSecure: req.secure, msg: "This is the dev branch."});
	}

	res.json({success: true, isSecure: req.secure, isDbConnected: db.dbcon.isValid(), msg: "Hello from SKOLLIE's Raspberry Pi! My domain is registered as soralei.com, is making use of dynamic dns, and has a valid SSL certificate which auto renews. It also has MariaDB set up."});
});

app.get("/register", (req, res) => {
	if(!req.secure){
		return res.redirect("https://" + req.headers.host + req.url);
	}

	if(req.subdomains[0] != null && req.subdomains[0] == "dev"){
		auth.RegisterUser("SKOLLIE", "abrakadabra", "soralei@gmail.com", (result) => {
			if(result && result.success){
				return res.json(result);
			} else {
				return res.json({success: false, err: result.error});
			}
		});
	} else {
		res.json({success: false, msg: "This request can only be accessed via the dev branch."});
	}
});

app.get("/verify_account", (req, res) => {
	if(!req.secure){
		return res.redirect("https://" + req.headers.host + req.url);
	}

	if(req.subdomains[0] != null && req.subdomains[0] == "dev"){
		auth.VerifyAccount(req.query.token, (result) => {
			res.json(result);
		});
	} else {
		res.json({success: false, msg: "This request can only be accessed via the dev branch."});
	}
});

app.get("/authenticate", (req, res) => {
	if(!req.secure){
		return res.redirect("https://" + req.headers.host + req.url);
	}

	if(req.subdomains[0] != null && req.subdomains[0] == "dev"){
		// login
		auth.Authenticate("SKOLLIE", "abrakadabra", (res) => {
			res.json(res);
		});
	} else {
		res.json({success: false, msg: "This request can only be accessed via the dev branch."});
	}
});