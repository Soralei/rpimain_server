const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv').config();
//const mariadb = require('mariadb/callback');
const db = require("./db_manager.js");

const credentials = {
	key: fs.readFileSync('/etc/letsencrypt/live/soralei.com/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/soralei.com/fullchain.pem')
	//cert: fs.readFileSync('/etc/letsencrypt/live/soralei.com/cert.pem')
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

	res.json({success: true, isSecure: req.secure, isDbConnected: dbcon.isValid(), msg: "Hello from SKOLLIE's Raspberry Pi! My domain is registered as soralei.com, is making use of dynamic dns, and has a valid SSL certificate which auto renews. It also has MariaDB set up."});
});
