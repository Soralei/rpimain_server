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

// Creates a secure password.
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

// Generates a unique token for the user which is to be used for email verification in order to activate the account.
function CreateRegisterToken(username){
    const raw_token = crypto.randomBytes(20).toString("hex");
    return crypto.createHmac("sha256", username).update(raw_token).digest("hex");
}

// Handles the account verification process, which activates the account.
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
            // If it found a token, but it's older than 15 minutes, it's expired but has yet to be cleaned up by the database.
            // This will also run if no matching token was found in the database (i.e. it's deleted, or tampered).
            return callback({error: "The verification link is invalid or expired."});
        }
    });
}

// Activates an account if it's not already activated.
function ActivateAccount(owner_id, callback){
    const queryString = `UPDATE user SET register_date=NOW() WHERE userid=${owner_id} AND register_date='N/A'`; // If no register date is set (i.e. N/A), it's not yet verified.
    db.dbcon.query(queryString, (err, res) => {
        if(err){
            return callback({error: err});
        }

        if(res && res.affectedRows > 0){
            return callback({success: true});
        } else {
            return callback({error: "User is already verified."});
        }
    });
}

// Checks if a user with the specified username already exists in the database.
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

function VerifyPassword(password, salt_secret, salt_rounds, callback){

}

// WIP. Will be used to "log in" the user and manage their session.
function Authenticate(username, password, callback){
    const queryString = `SELECT * FROM user WHERE username='${username}'`;
    db.dbcon.query(queryString, (err, res) => {
        if(err){
            return callback({error: err});
        }

        if(res && res.length > 0){
            console.log(res[0].userid);
            //VerifyPassword();
        } else {
            return callback({error: `Username of password is invalid.`});
        }
    });
}

// Handles the user registration process.
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
    
    // The registration date is "N/A" until the account has been verified.
    const queryString = `INSERT INTO user(username, password, email, salt_secret, salt_rounds, register_date) VALUES(?, ?, ?, ?, ?, 'N/A')`;
    const queryValues = [username, scrambled_password, email, salt_random_secret, salt_random_rounds];
    db.dbcon.query(queryString, queryValues, (err, res) => {
        if(err){
            return callback({error: err});
        }

        if(!res){ // This should never trigger, but just in case...
            return callback({error: `DATABASE: Failed to insert user: ${username} into the database for some reason.`});
        }

        // Create and send the registration token, which the user can use to verify their email.
        const token = CreateRegisterToken(username);
        db.dbcon.query(`INSERT INTO register_token(owner_id, token, creation_date) VALUES(${res.insertId}, '${token}', NOW())`, (err, res) => {
            if(err){
                return callback({error: `DATABASE: Account was created, but failed to create a register_token. ${err}`});
            }
            return callback({success: true, token: token}); // Temporary.
        });
    });
}

module.exports = {
    RegisterUser: RegisterUser,
    VerifyAccount: VerifyAccount,
    Authenticate: Authenticate
}