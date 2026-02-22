const db = require('../config/database');

// Get daily revenue
exports.getDailyRevenue = async (req, res) => {
    try {
        const [result] = await db.query(
            `SELECT 
                DATE(created_at) as date,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as sales_count
            FROM sales 
            WHERE DATE(created_at) = CURDATE()
            GROUP BY DATE(created_at)`
        );

        res.json(result[0] || { date: new Date().toISOString().split('T')[0], revenue: 0, sales_count: 0 });
    } catch (error) {
        console.error('Get daily revenue error:', error);
        res.status(500).json({ error: 'Failed to fetch daily revenue' });
    }
};

// Get weekly revenue
exports.getWeeklyRevenue = async (req, res) => {
    try {
        const [result] = await db.query(
            `SELECT 
                DATE(created_at) as date,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as sales_count
            FROM sales 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC`
        );

        res.json(result);
    } catch (error) {
        console.error('Get weekly revenue error:', error);
        res.status(500).json({ error: 'Failed to fetch weekly revenue' });
    }
};

// Get monthly revenue
exports.getMonthlyRevenue = async (req, res) => {
    try {
        const [result] = await db.query(
            `SELECT 
                WEEK(created_at) as week,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as sales_count
            FROM sales 
            WHERE MONTH(created_at) = MONTH(CURDATE()) 
            AND YEAR(created_at) = YEAR(CURDATE())
            GROUP BY WEEK(created_at)
            ORDER BY week`
        );

        res.json(result);
    } catch (error) {
        console.error('Get monthly revenue error:', error);
        res.status(500).json({ error: 'Failed to fetch monthly revenue' });
    }
};

// Get sales breakdown by service type
exports.getSalesByService = async (req, res) => {
    try {
        const [result] = await db.query(
            `SELECT 
                srv.name as service_name,
                COUNT(si.id) as total_items,
                COALESCE(SUM(si.subtotal), 0) as total_revenue
            FROM sale_items si
            JOIN services srv ON si.service_id = srv.id
            JOIN sales s ON si.sale_id = s.id
            WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY srv.id, srv.name
            ORDER BY total_revenue DESC`
        );

        res.json(result);
    } catch (error) {
        console.error('Get sales by service error:', error);
        res.status(500).json({ error: 'Failed to fetch sales breakdown' });
    }
};

// Get outstanding payments
exports.getOutstandingPayments = async (req, res) => {
    try {
        const [result] = await db.query(
            `SELECT 
                s.id as sale_id,
                s.total_amount,
                s.created_at,
                c.name as customer_name,
                c.phone as customer_phone
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.payment_status = 'unpaid'
            ORDER BY s.created_at DESC`
        );

        const [summary] = await db.query(
            `SELECT 
                COUNT(*) as total_unpaid,
                COALESCE(SUM(total_amount), 0) as total_unpaid_amount
            FROM sales 
            WHERE payment_status = 'unpaid'`
        );

        res.json({
            outstanding: result,
            summary: summary[0]
        });
    } catch (error) {
        console.error('Get outstanding payments error:', error);
        res.status(500).json({ error: 'Failed to fetch outstanding payments' });
    }
};

// Get garment/item count statistics
exports.getGarmentStats = async (req, res) => {
    try {
        // Today's garment count
        const [todayResult] = await db.query(
            `SELECT COALESCE(SUM(si.quantity), 0) AS today_count
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE DATE(s.created_at) = CURDATE()`
        );

        // This week's garment count
        const [weekResult] = await db.query(
            `SELECT COALESCE(SUM(si.quantity), 0) AS week_count
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
        );

        // This month's garment count
        const [monthResult] = await db.query(
            `SELECT COALESCE(SUM(si.quantity), 0) AS month_count
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE MONTH(s.created_at) = MONTH(CURDATE())
             AND YEAR(s.created_at) = YEAR(CURDATE())`
        );

        // Per-service breakdown (last 30 days)
        const [breakdown] = await db.query(
            `SELECT srv.name AS service_name,
                    COALESCE(SUM(si.quantity), 0) AS total_items,
                    COUNT(DISTINCT si.sale_id) AS order_count
             FROM sale_items si
             JOIN services srv ON si.service_id = srv.id
             JOIN sales s ON si.sale_id = s.id
             WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY srv.id, srv.name
             ORDER BY total_items DESC`
        );

        res.json({
            today: todayResult[0].today_count,
            week: weekResult[0].week_count,
            month: monthResult[0].month_count,
            breakdown: breakdown
        });
    } catch (error) {
        console.error('Get garment stats error:', error);
        res.status(500).json({ error: 'Failed to fetch garment statistics' });
    }
};
