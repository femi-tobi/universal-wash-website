const migrate = require('../migrate');

exports.runMigrations = async (req, res) => {
    try {
        // Only admin should be allowed - route will be protected by roleCheck middleware
        await migrate.run();
        res.json({ success: true, message: 'Migrations executed. Check server logs for details.' });
    } catch (err) {
        console.error('Migration API error:', err);
        res.status(500).json({ error: 'Failed to run migrations', details: err.message });
    }
};
