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

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.get('/', (req, res) => {

	if(!req.secure){
		return res.redirect("https://" + req.headers.host + req.url);
	}

	if(req.subdomains[0] != null && req.subdomains[0] == "dev"){
		return res.json({success: true, isSecure: req.secure, msg: "This is the dev branch."});
	}

	res.json({success: true, isSecure: req.secure, isDbConnected: db.dbcon.isValid(), msg: "Hello from SKOLLIE's Raspberry Pi! My domain is registered as soralei.com, is making use of dynamic dns, and has a valid SSL certificate which auto renews. It also has MariaDB set up."});
});

app.post("/register", (req, res) => {
	if(!req.secure){
		return res.status(403).json({error: `Warning! The request was sent via HTTP, use the HTTPS when using this endpoint.`});
	}

	const data = req.body;

	if(!data.username || !data.password || !data.email){
		res.status(400).json({error: `Invalid parameters.`});
	}

	auth.RegisterUser(data.username, data.password, data.email, (result) => {
		if(result && result.success){
			res.status(200).json(result);
		}
		res.status(406).json(result);
	});
});

app.get("/verify", (req, res) => {
	if(!req.secure){
		return res.redirect("https://" + req.headers.host + req.url);
	}

	auth.VerifyAccount(req.query.token, (result) => {
		if(result){
			res.status(200).json(result);
		}
		res.status(401).json(result);
	});
});

app.post('/authenticate', (req, res) => {
	if(!req.secure){
		return res.status(403).json({error: `Warning! The request was sent via HTTP, use the HTTPS when using this endpoint.`});
	}

	const data = req.body;

	if(!data.username || !data.password){
		res.status(400).json({error: `Invalid parameters.`});
	}

	auth.Authenticate(data.username, data.password, (result) => {
		if(result){
			res.status(200).json(result);
		}
		res.status(401).json(result);
	});
});