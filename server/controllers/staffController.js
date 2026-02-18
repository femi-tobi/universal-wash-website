const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Get all staff
exports.getAllStaff = async (req, res) => {
    try {
        const [staff] = await db.query(
            'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
        );

        res.json(staff);
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
};

// Add new staff
exports.addStaff = async (req, res) => {
    try {
        const { username, password, full_name, role } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!['admin', 'staff'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, full_name, role]
        );

        res.json({
            success: true,
            user_id: result.insertId,
            message: 'Staff member added successfully'
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        console.error('Add staff error:', error);
        res.status(500).json({ error: 'Failed to add staff member' });
    }
};

// Update staff
exports.updateStaff = async (req, res) => {
    try {
        const staffId = req.params.id;
        const { username, full_name, role, password } = req.body;

        let query = 'UPDATE users SET username = ?, full_name = ?, role = ?';
        let params = [username, full_name, role];

        // If password is provided, hash and update it
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(staffId);

        await db.query(query, params);

        res.json({ success: true, message: 'Staff member updated successfully' });
    } catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({ error: 'Failed to update staff member' });
    }
};

// Deactivate staff
exports.deleteStaff = async (req, res) => {
    try {
        const staffId = req.params.id;

        await db.query(
            'UPDATE users SET is_active = 0 WHERE id = ?',
            [staffId]
        );

        res.json({ success: true, message: 'Staff member deactivated successfully' });
    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({ error: 'Failed to deactivate staff member' });
    }
};
