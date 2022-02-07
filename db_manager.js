const dotenv = require('dotenv').config();
const mariadb = require('mariadb/callback');

const dbcon = mariadb.createConnection({
        host: '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        connectionLimit: 5
});

dbcon.connect(err => {
   if(err){
       console.log(`DATABASE: Failed to connect to the databse. ${err}`);
   } else {
       console.log(`DATABASE: Connection to the database established.`);
       dbcon.query(`USE users`, (req, res) => {
           if(err){
               console.log(`DATABASE: Something went wrong when trying to switch to the users database.`);
           }
           console.log(`DATABASE: Switched to the users database.`);
       });
   }
});

module.exports = {
    dbcon: dbcon
}