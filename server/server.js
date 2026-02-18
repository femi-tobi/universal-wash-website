const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 3000;

// Wait for database to initialize before starting server
db.ready.then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
