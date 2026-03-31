var fs = require('fs');
var path = require('path');
var db = require('../config/database');

var PRICELIST_PATH = path.join(__dirname, '../data/pricelist.json');

/**
 * GET /api/pricelist
 * Fetches the laundry items price list (male/female/bulks).
 * We set X-Debug-Headers to verify this specific code is running on the server.
 */
exports.getPricelist = async function(req, res) {
    res.setHeader('X-Debug-Identify', 'THIS_IS_THE_CORRECT_PRICELIST_CONTROLLER');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        // Ensure table exists (defensive)
        await db.query('CREATE TABLE IF NOT EXISTS pricelist_data (id INT PRIMARY KEY DEFAULT 1, data JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
        
        // Fetch the one and only pricelist record
        var result = await db.query('SELECT data FROM pricelist_data WHERE id = 1');
        var rows = result[0];
        
        if (rows && rows.length > 0) {
            var data = rows[0].data;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return res.json(data);
        }
    } catch (dbErr) {
        console.error('DB pricelist read error:', dbErr.message);
    }

    // Fallback to local JSON file if DB fails or is empty
    try {
        if (fs.existsSync(PRICELIST_PATH)) {
            var raw = fs.readFileSync(PRICELIST_PATH, 'utf8');
            return res.json(JSON.parse(raw));
        }
    } catch (err) {
        console.error('File pricelist read error:', err);
    }

    res.status(500).json({ error: 'Price list not found in DB or File' });
};

/**
 * PUT /api/pricelist
 * Updates the price list (Admin only).
 */
exports.updatePricelist = async function(req, res) {
    try {
        var body = req.body;
        if (!body || !body.male || !body.female) {
            return res.status(400).json({ error: 'Invalid price list format' });
        }
        var jsonStr = JSON.stringify(body);

        // Update DB
        try {
            await db.query('CREATE TABLE IF NOT EXISTS pricelist_data (id INT PRIMARY KEY DEFAULT 1, data JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
            var checkResult = await db.query('SELECT id FROM pricelist_data WHERE id = 1');
            var existing = checkResult[0];
            
            if (existing && existing.length > 0) {
                await db.query('UPDATE pricelist_data SET data = ?, updated_at = NOW() WHERE id = 1', [jsonStr]);
            } else {
                await db.query('INSERT INTO pricelist_data (id, data) VALUES (1, ?)', [jsonStr]);
            }
        } catch (dbErr) {
            console.error('DB pricelist update error:', dbErr.message);
        }

        // Keep file in sync if possible
        try {
            fs.writeFileSync(PRICELIST_PATH, JSON.stringify(body, null, 2), 'utf8');
        } catch (e) {}

        res.json({ success: true, message: 'Price list updated successfully' });
    } catch (err) {
        console.error('Error writing pricelist:', err);
        res.status(500).json({ error: 'Failed to save price list' });
    }
};
