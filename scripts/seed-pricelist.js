/**
 * Seed Pricelist Script
 * 
 * This script reads the local pricelist.json and inserts it into the
 * pricelist_data table in your database (MySQL, Postgres, or SQLite).
 * 
 * Usage:
 *   node scripts/seed-pricelist.js
 * 
 * It will:
 *  1. Connect to the database using your .env settings
 *  2. Create the pricelist_data table if it doesn't exist
 *  3. Insert or replace the pricelist JSON data
 */

const fs = require('fs');
const path = require('path');

async function seed() {
    // Load database module (this auto-connects based on .env)
    const db = require('../server/config/database');
    await db.ready;

    console.log(`Connected to ${db.type} database.`);

    // Read the local pricelist.json
    const pricelistPath = path.join(__dirname, '../server/data/pricelist.json');
    if (!fs.existsSync(pricelistPath)) {
        console.error('ERROR: server/data/pricelist.json not found!');
        process.exit(1);
    }

    const raw = fs.readFileSync(pricelistPath, 'utf8');
    const parsed = JSON.parse(raw); // validate it's valid JSON
    console.log(`Loaded pricelist.json: ${parsed.male?.length || 0} male items, ${parsed.female?.length || 0} female items, ${parsed.bulkDiscounts?.length || 0} discount rules`);

    // Create table if not exists
    if (db.type === 'mysql') {
        await db.query(`
            CREATE TABLE IF NOT EXISTS pricelist_data (
                id INT PRIMARY KEY DEFAULT 1,
                data JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } else if (db.type === 'postgres') {
        await db.query(`
            CREATE TABLE IF NOT EXISTS pricelist_data (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    } else {
        await db.query(`
            CREATE TABLE IF NOT EXISTS pricelist_data (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data TEXT NOT NULL,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `);
    }
    console.log('✓ pricelist_data table ready.');

    // Check if data already exists
    const [existing] = await db.query('SELECT id FROM pricelist_data WHERE id = 1');
    if (existing && existing.length > 0) {
        // Update
        if (db.type === 'mysql') {
            await db.query('UPDATE pricelist_data SET data = ?, updated_at = NOW() WHERE id = 1', [raw]);
        } else if (db.type === 'postgres') {
            await db.query('UPDATE pricelist_data SET data = ?, updated_at = NOW() WHERE id = 1', [raw]);
        } else {
            await db.query("UPDATE pricelist_data SET data = ?, updated_at = datetime('now') WHERE id = 1", [raw]);
        }
        console.log('✓ Pricelist updated in database (replaced existing data).');
    } else {
        // Insert
        await db.query('INSERT INTO pricelist_data (id, data) VALUES (1, ?)', [raw]);
        console.log('✓ Pricelist inserted into database.');
    }

    console.log('\n🎉 Done! The pricelist is now stored in your database.');
    console.log('   Your deployed server will load it from the database automatically.');
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
