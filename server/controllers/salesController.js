const db = require('../config/database');

// Create new sale with items
exports.createSale = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const { customer_name, customer_phone, customer_address, items, payment_status } = req.body;

        // Validate input
        if (!customer_name || !customer_phone || !items || items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if customer exists or create new one
        let [customers] = await connection.query(
            'SELECT id FROM customers WHERE phone = ?',
            [customer_phone]
        );

        let customerId;
        if (customers.length > 0) {
            customerId = customers[0].id;
            // Update customer name and address if provided
            await connection.query(
                'UPDATE customers SET name = ?, address = COALESCE(?, address) WHERE id = ?',
                [customer_name, customer_address || null, customerId]
            );
        } else {
            const [result] = await connection.query(
                'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
                [customer_name, customer_phone, customer_address || null]
            );
            customerId = result.insertId;
        }

        // Calculate total amount
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += parseFloat(item.subtotal);
        }

        // Create sale
        const paymentDate = payment_status === 'paid' ? new Date().toISOString() : null;
        const [saleResult] = await connection.query(
            'INSERT INTO sales (customer_id, staff_id, total_amount, payment_status, payment_date) VALUES (?, ?, ?, ?, ?)',
            [customerId, req.user.id, totalAmount, payment_status, paymentDate]
        );

        const saleId = saleResult.insertId;

        // Insert sale items
        for (const item of items) {
            await connection.query(
                'INSERT INTO sale_items (sale_id, service_id, item_type, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [saleId, item.service_id, item.item_type, item.quantity, item.unit_price, item.subtotal]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            sale_id: saleId,
            message: 'Sale created successfully'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create sale error:', error);
        res.status(500).json({ error: 'Failed to create sale' });
    } finally {
        connection.release();
    }
};

// Get today's sales total
exports.getDailySales = async (req, res) => {
    try {
        const [result] = await db.query(
            `SELECT 
                COUNT(*) as total_sales,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) as unpaid_amount
            FROM sales 
            WHERE DATE(created_at) = CURDATE()`
        );

        res.json(result[0]);
    } catch (error) {
        console.error('Get daily sales error:', error);
        res.status(500).json({ error: 'Failed to fetch daily sales' });
    }
};

// Get sale details
exports.getSaleDetails = async (req, res) => {
    try {
        const saleId = req.params.id;

        // Get sale info
        const [sales] = await db.query(
            `SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, u.full_name as staff_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN users u ON s.staff_id = u.id
            WHERE s.id = ?`,
            [saleId]
        );

        if (sales.length === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        // Get sale items
        const [items] = await db.query(
            `SELECT si.*, srv.name as service_name
            FROM sale_items si
            JOIN services srv ON si.service_id = srv.id
            WHERE si.sale_id = ?`,
            [saleId]
        );

        res.json({
            sale: sales[0],
            items: items
        });
    } catch (error) {
        console.error('Get sale details error:', error);
        res.status(500).json({ error: 'Failed to fetch sale details' });
    }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
    try {
        const saleId = req.params.id;
        const { payment_status } = req.body;

        if (!['paid', 'unpaid'].includes(payment_status)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }

        const paymentDate = payment_status === 'paid' ? new Date().toISOString() : null;

        await db.query(
            'UPDATE sales SET payment_status = ?, payment_date = ? WHERE id = ?',
            [payment_status, paymentDate, saleId]
        );

        res.json({ success: true, message: 'Payment status updated' });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
};

// Get all unpaid sales (with optional name/phone search)
exports.getUnpaidSales = async (req, res) => {
    try {
        const { q } = req.query;
        let query = `
            SELECT s.id, s.total_amount, s.created_at,
                   c.name AS customer_name, c.phone AS customer_phone,
                   u.full_name AS staff_name,
                   (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN users u ON s.staff_id = u.id
            WHERE s.payment_status = 'unpaid'
        `;
        const params = [];
        if (q && q.trim() !== '') {
            query += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
            params.push(`%${q.trim()}%`, `%${q.trim()}%`);
        }
        query += ` ORDER BY s.created_at DESC`;

        const [rows] = await db.query(query, params);

        // Total outstanding
        let totalQuery = `SELECT COALESCE(SUM(total_amount),0) AS total_outstanding, COUNT(*) AS total_count FROM sales WHERE payment_status = 'unpaid'`;
        const [totals] = await db.query(totalQuery);

        res.json({
            sales: rows,
            total_outstanding: totals[0].total_outstanding,
            total_count: totals[0].total_count
        });
    } catch (error) {
        console.error('Get unpaid sales error:', error);
        res.status(500).json({ error: 'Failed to fetch unpaid sales' });
    }
};
