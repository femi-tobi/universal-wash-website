const db = require('../config/database');

// Get all customers
exports.getAllCustomers = async (req, res) => {
    try {
        const [customers] = await db.query(
            'SELECT * FROM customers ORDER BY created_at DESC'
        );

        res.json(customers);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
};

// Get customer order history
exports.getCustomerHistory = async (req, res) => {
    try {
        const customerId = req.params.id;

        // Get customer info
        const [customers] = await db.query(
            'SELECT * FROM customers WHERE id = ?',
            [customerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get all orders
        const [orders] = await db.query(
            `SELECT s.*, u.full_name as staff_name
            FROM sales s
            JOIN users u ON s.staff_id = u.id
            WHERE s.customer_id = ?
            ORDER BY s.created_at DESC`,
            [customerId]
        );

        // Calculate summary
        const [summary] = await db.query(
            `SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_spent,
                COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) as outstanding_amount
            FROM sales 
            WHERE customer_id = ?`,
            [customerId]
        );

        res.json({
            customer: customers[0],
            orders: orders,
            summary: summary[0]
        });
    } catch (error) {
        console.error('Get customer history error:', error);
        res.status(500).json({ error: 'Failed to fetch customer history' });
    }
};
