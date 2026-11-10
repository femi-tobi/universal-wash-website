const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. Login Logic
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Get user from database
        // Note: db is the pool we exported in database.js
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? AND is_active IS NOT FALSE',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password using bcryptjs (safe for cPanel)
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        // Fallback secret if process.env.JWT_SECRET is missing to prevent 500 error
        const secret = process.env.JWT_SECRET || 'change_this_to_a_long_random_string';
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            secret,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Login failed', 
            details: error.message 
        });
    }
};

// 2. Get Current User Info (Required by auth.js line 10)
exports.getMe = async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, full_name, role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
};

// 3. Logout (Required by auth.js line 11)
exports.logout = (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
};