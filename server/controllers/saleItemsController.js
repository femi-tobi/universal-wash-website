const db = require('../config/database');

// Update description for a sale item. Only admin or the staff who created the sale can edit.
exports.updateDescription = async (req, res) => {
    const itemId = req.params.id;
    const { description } = req.body;

    if (typeof description === 'undefined') return res.status(400).json({ error: 'description is required' });

    try {
        // Check whether the description column exists in sale_items for this DB
        let hasDescription = false;
        if (db.type === 'sqlite') {
            const [info] = await db.query("SELECT * FROM pragma_table_info('sale_items')");
            hasDescription = info.some(c => c.name === 'description');
        } else if (db.type === 'postgres') {
            const [rows] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'description'");
            hasDescription = rows.length > 0;
        } else {
            const [rows] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'description' AND TABLE_SCHEMA = DATABASE()");
            hasDescription = rows.length > 0;
        }

        if (!hasDescription) return res.status(400).json({ error: 'description column not available on this database' });

        // Fetch the item and sale owner
        const [rows] = await db.query(
            'SELECT si.id as item_id, si.sale_id, s.staff_id FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.id = ?',
            [itemId]
        );
        const item = rows && rows[0];
        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Authorization: admin or sale owner
        if (req.user.role !== 'admin' && req.user.id !== item.staff_id) {
            return res.status(403).json({ error: 'Not authorized to edit this item' });
        }

        await db.query('UPDATE sale_items SET description = ? WHERE id = ?', [description, itemId]);

        return res.json({ success: true, id: itemId, description });
    } catch (err) {
        console.error('Failed to update sale item description:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
