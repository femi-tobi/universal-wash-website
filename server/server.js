const path = require('path');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const app = express();

// 1. Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Paths
const rootPath = path.resolve(__dirname, '..');
const publicPath = path.join(rootPath, 'public');
const loginFile = path.join(publicPath, 'views', 'login.html');

app.use(express.static(publicPath));

// 3. Import Routes
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const serviceRoutes = require('./routes/services');
const dashboardRoutes = require('./routes/dashboard');
const staffRoutes = require('./routes/staff');
const customerRoutes = require('./routes/customers');
const pricelistRoutes = require('./routes/pricelist');
const reportsRoutes = require('./routes/reports');
const cronService = require('./services/cronService');

// 4. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/pricelist', pricelistRoutes);
app.use('/api/reports', reportsRoutes);

// Initialize weekly report cron scheduler
cronService.init();

// 5. SPA Frontend Handling
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    if (req.url === '/' || req.url === '/index.html' || !path.extname(req.url)) {
        return res.sendFile(loginFile, (err) => {
            if (err) {
                console.error('Error sending login file:', err.message);
                if (!res.headersSent) {
                    res.status(200).send('<!DOCTYPE html><html><head><title>Universal Wash</title></head><body><h1>Universal Wash Server is Running</h1><p><a href="/views/login.html">Click here to Login</a></p></body></html>');
                }
            }
        });
    }
    next();
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Server error', message: err.message });
});

// 7. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Universal Wash Server running on port ${PORT}`);
});

module.exports = app;

