const fs = require('fs');
const path = require('path');

const PRICELIST_PATH = path.join(__dirname, '../data/pricelist.json');

// GET /api/pricelist  — available to all authenticated users
exports.getPricelist = (req, res) => {
    try {
        const data = fs.readFileSync(PRICELIST_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('Error reading pricelist:', err);
        res.status(500).json({ error: 'Failed to load price list' });
    }
};

// PUT /api/pricelist  — admin only
exports.updatePricelist = (req, res) => {
    try {
        const body = req.body;
        if (!body || !body.male || !body.female) {
            return res.status(400).json({ error: 'Invalid price list format' });
        }
        fs.writeFileSync(PRICELIST_PATH, JSON.stringify(body, null, 2), 'utf8');
        res.json({ success: true, message: 'Price list updated successfully' });
    } catch (err) {
        console.error('Error writing pricelist:', err);
        res.status(500).json({ error: 'Failed to save price list' });
    }
};
