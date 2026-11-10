require('dotenv').config();
const db = require('./server/config/database');
(async () => {
    try {
        console.log('Altering ENUM...');
        await db.query("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('paid', 'unpaid', 'partpaid') DEFAULT 'unpaid'");
        console.log('ENUM altered.');
    } catch(e) { console.error('ENUM error:', e.message); }

    try {
        console.log('Adding amount_paid column...');
        await db.query("ALTER TABLE sales ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0");
        console.log('amount_paid added.');
    } catch(e) { console.error('amount_paid error:', e.message); }
    
    console.log('Done.');
    process.exit(0);
})();
