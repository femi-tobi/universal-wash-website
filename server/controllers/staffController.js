const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Get all staff
exports.getAllStaff = async (req, res) => {
    try {
        // Build a safe SELECT column list based on actual table columns (works for SQLite)
        let cols = ['id','username','full_name','role','is_active','created_at'];
        try {
            if (db.type === 'sqlite') {
                const [info] = await db.query("PRAGMA table_info('users')");
                const names = (info || []).map(r => r.name);
                if (names.includes('address')) cols.splice(5,0,'address'); // insert before created_at
                if (names.includes('phone')) cols.splice(6,0,'phone');
            }
        } catch (e) {
            // ignore and fall back to default cols
        }

        const sql = `SELECT ${cols.join(', ')} FROM users ORDER BY created_at DESC`;
        const [staff] = await db.query(sql);
        return res.json(staff);
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

        // Build safe column list dynamically (avoid referencing columns that don't exist)
        let cols = ['id','username','full_name','role','is_active','created_at'];
        try {
            if (db.type === 'sqlite') {
                const [info] = await db.query("PRAGMA table_info('users')");
                const names = (info || []).map(r => r.name);
                if (names.includes('address')) cols.splice(5,0,'address');
                if (names.includes('phone')) cols.splice(6,0,'phone');
            }
        } catch (e) { /* ignore */ }

        const sql = `SELECT ${cols.join(', ')} FROM users WHERE id = ?`;
        const [rows] = await db.query(sql, [staffId]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
        return res.json(rows[0]);
    } catch (error) {
        console.error('Get staff by id error:', error);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
};

// Staff: get my sales for today
exports.getMySalesByDay = async (req, res) => {
    try {
        const staffId = req.user.id;
        const [sales] = await db.query(
            `SELECT s.id, s.total_amount, s.created_at, s.payment_status, s.staff_id, c.name as customer_name, c.phone as customer_phone
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE DATE(s.created_at) = CURDATE() AND s.staff_id = ?
             ORDER BY s.created_at DESC`,
            [staffId]
        );

        // Attach items for each sale
        for (const s of sales) {
            const [items] = await db.query(
                `SELECT si.*, srv.name as service_name FROM sale_items si LEFT JOIN services srv ON si.service_id = srv.id WHERE si.sale_id = ?`,
                [s.id]
            );
            s.items = items;
        }

        res.json({ sales });
    } catch (error) {
        console.error('Get my daily sales error:', error);
        res.status(500).json({ error: 'Failed to fetch daily sales' });
    }
};

// Staff: get my sales for last 7 days
exports.getMySalesByWeek = async (req, res) => {
    try {
        const staffId = req.user.id;
        const [sales] = await db.query(
            `SELECT s.id, s.total_amount, s.created_at, s.payment_status, s.staff_id, c.name as customer_name, c.phone as customer_phone
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND s.staff_id = ?
             ORDER BY s.created_at DESC`,
            [staffId]
        );
        for (const s of sales) {
            const [items] = await db.query(`SELECT si.*, srv.name as service_name FROM sale_items si LEFT JOIN services srv ON si.service_id = srv.id WHERE si.sale_id = ?`, [s.id]);
            s.items = items;
        }
        res.json({ sales });
    } catch (error) {
        console.error('Get my weekly sales error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly sales' });
    }
};

// Staff: get my sales for current month
exports.getMySalesByMonth = async (req, res) => {
    try {
        const staffId = req.user.id;
        const [sales] = await db.query(
            `SELECT s.id, s.total_amount, s.created_at, s.payment_status, s.staff_id, c.name as customer_name, c.phone as customer_phone
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE()) AND s.staff_id = ?
             ORDER BY s.created_at DESC`,
            [staffId]
        );
        for (const s of sales) {
            const [items] = await db.query(`SELECT si.*, srv.name as service_name FROM sale_items si LEFT JOIN services srv ON si.service_id = srv.id WHERE si.sale_id = ?`, [s.id]);
            s.items = items;
        }
        res.json({ sales });
    } catch (error) {
        console.error('Get my monthly sales error:', error);
        res.status(500).json({ error: 'Failed to fetch monthly sales' });
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
