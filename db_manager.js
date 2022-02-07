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
       console.log(`Failed to connect to the databse. ${err}`);
   } else {
       console.log(`Connection to the database established.`);
   }
});

module.exports = {
    dbcon: dbcon
}