const crypto = require('crypto');
const db = require("./db_manager.js");

function ValidateUsername(username){
    const _regex = /^(?!^_.*|.*_$|.*__.*)[A-Za-z0-9_]{4,16}$/

    // Allow only 4-16 alphanumerics with underscores.
    // Can't start or end with an underscore and an underscore can't be used multiple times in a row.
    if(!_regex.test(username)){
        return false;
    }

    // Allow only 3 underscores in total.
    if((username.match(/_/g) || []).length > 3){
        return false;
    }

    return true;
}

function ValidatePassword(password){
    const _regex = /^[\x00-\xFF]{4,32}$/

    // Extended ASCII character set.
    if(!_regex.test(password)){
        return false;
    }

    return true;
}

function ValidateEmail(email){
    // Reasonable email length.
    if(email.length < 2 || email.length > 32){
        return false;
    }

    // An email address has exactly one @.
    if((email.match(/@/g) || []).length != 1){
        return false;
    }

    return true;
}

function ScramblePassword(password, options={}){
    const base_secret = options.base_secret;        // This should be a secret known only to the server.
    const salt_secret = options.salt_secret;        // Unique salt secret generated and stored in the database for the user specifically.
    const salt_rounds = options.salt_rounds;        // Should be a random amount which is stored for the user in the database.

    let output = crypto.createHmac("sha256", base_secret).update(password).digest("hex");
    for(let i = 0; i < salt_rounds; i++){
        output = crypto.createHmac("sha256", salt_secret).update(output).digest("hex");
    }

    return output;
}

function CreateRegisterToken(username){
    const raw_token = crypto.randomBytes(20).toString("hex");
    return crypto.createHmac("sha256", username).update(raw_token).digest("hex");
}

function VerifyAccount(token, callback){
    const queryString = `SELECT owner_id FROM register_token WHERE token='${token}' AND creation_date > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`;
    db.dbcon.query(queryString, (err, res) => {
        if(err){
            return callback({error: err});
        }

        if(res && res.length > 0){
            ActivateAccount(res[0].owner_id, (result) => {
                return callback(result);
            });
        } else {
            return callback({error: "The verification link is invalid or expired."});
        }
    });
}

function ActivateAccount(owner_id, callback){
    const queryString = `UPDATE user SET register_date=NOW() WHERE userid=${owner_id} AND register_date='N/A'`;
    db.dbcon.query(queryString, (err, res) => {
        if(err){
            return callback({error: err});
        }

        console.log(res);

        if(res && res.length > 0){
            return callback({success: true});
        } else {
            return callback({error: "User is already registered."});
        }
    });
}

function UserExists(username){
    return new Promise((resolve, reject) => {
        const queryString = `SELECT userid FROM user WHERE username='${username}'`;
        db.dbcon.query(queryString, (err, res) => {
            if(err){
                console.log(`DATABASE: An error occurred when querying the database for the username: ${username}. ${err}`);
                reject();
            }
    
            if(res.length > 0){
                resolve(true); // User already exists.
            }

            resolve(false); // No user exists.
        });
    });
}

async function RegisterUser(username, password, email, callback){
    if(!ValidateUsername(username)){
        return callback({error: `Failed to register user. Username failed to validate.`});
    }

    if(!ValidatePassword(password)){
        return callback({error: `Failed to register user. Password failed to validate.`});
    }

    if(!ValidateEmail(email)){
        return callback({error: `Failed to register user. Email failed to validate.`});
    }

    if(await UserExists(username)){
        return callback({error: `Failed to register user. Username is already registered.`});
    }

    const salt_random_secret = crypto.randomBytes(20).toString("hex");
    const salt_random_rounds = Math.floor(Math.random() * 11 + 1);
    const scrambled_password = ScramblePassword(password, {base_secret: process.env.PW_SECRET, salt_secret: salt_random_secret, salt_rounds: salt_random_rounds});
    
    const queryString = `INSERT INTO user(username, password, email, salt_secret, salt_rounds, register_date) VALUES(?, ?, ?, ?, ?, 'N/A')`;
    const queryValues = [username, scrambled_password, email, salt_random_secret, salt_random_rounds];
    db.dbcon.query(queryString, queryValues, (err, res) => {
        if(err){
            return callback({error: err});
        }

        if(!res){
            return callback({error: `DATABASE: Failed to insert user: ${username} into the database for some reason.`});
        }

        const token = CreateRegisterToken(username);
        db.dbcon.query(`INSERT INTO register_token(owner_id, token, creation_date) VALUES(${res.insertId}, '${token}', NOW())`, (err, res) => {
            if(err){
                return callback({error: `DATABASE: Failed to create register_token. ${err}`});
            }
            return callback({success: true, token: token});
        });
    });
}

module.exports = {
    RegisterUser: RegisterUser,
    VerifyAccount: VerifyAccount
}