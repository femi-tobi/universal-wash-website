const mysql = require('mysql2');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Create the pool directly
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: '+01:00', // Force WAT
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export the promise-based version of the pool
const promisePool = pool.promise();

// Export as an object that matches what your controllers expect
module.exports = {
    query: (sql, params) => promisePool.query(sql, params),
    getConnection: () => promisePool.getConnection(),
    type: 'mysql'
};

console.log('✅ Database module loaded and ready');