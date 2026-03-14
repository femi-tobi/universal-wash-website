const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Get all staff
exports.getAllStaff = async (req, res) => {
    try {
        const [staff] = await db.query(
            'SELECT id, username, full_name, role, is_active, address, phone, created_at FROM users ORDER BY created_at DESC'
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
        const { username, password, full_name, role, address, phone } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ error: 'All required fields are missing' });
        }

        if (!['admin', 'staff'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (username, password, full_name, role, address, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, full_name, role, address || null, phone || null]
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
        const actor = req.user; // from auth middleware

        // Allow admin or the user themselves
        if (actor.role !== 'admin' && Number(actor.id) !== Number(staffId)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const { username, full_name, role, password, address, phone } = req.body;

        // Build dynamic update
        let updates = [];
        let params = [];
        if (username) { updates.push('username = ?'); params.push(username); }
        if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
        if (role && actor.role === 'admin') { updates.push('role = ?'); params.push(role); }
        if (typeof address !== 'undefined') { updates.push('address = ?'); params.push(address); }
        if (typeof phone !== 'undefined') { updates.push('phone = ?'); params.push(phone); }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        params.push(staffId);

        await db.query(query, params);

        res.json({ success: true, message: 'Staff member updated successfully' });
    } catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({ error: 'Failed to update staff member' });
    }
};

// Get one staff (admin can fetch any, a staff can fetch own)
exports.getStaffById = async (req, res) => {
    try {
        const staffId = req.params.id;
        const actor = req.user;

        if (!actor) return res.status(401).json({ error: 'Auth required' });

        if (actor.role !== 'admin' && Number(actor.id) !== Number(staffId)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const [rows] = await db.query('SELECT id, username, full_name, role, is_active, address, phone, created_at FROM users WHERE id = ?', [staffId]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Staff not found' });

        res.json(rows[0]);
    } catch (error) {
        console.error('Get staff by id error:', error);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
};

// Deactivate staff
exports.deleteStaff = async (req, res) => {
    try {
        const staffId = req.params.id;

        await db.query(
            'UPDATE users SET is_active = false WHERE id = ?',
            [staffId]
        );

        res.json({ success: true, message: 'Staff member deactivated successfully' });
    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({ error: 'Failed to deactivate staff member' });
    }
};
