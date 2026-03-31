const db = require('../config/database');

// Helper: check whether a table has a given column across DBs
async function hasColumn(table, column) {
    try {
        if (db.type === 'sqlite') {
            const [info] = await db.query(`SELECT * FROM pragma_table_info('${table}')`);
            const names = (info || []).map(r => r.name);
            return names.includes(column);
        }
        if (db.type === 'postgres') {
            const [rows] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", [table, column]);
            return (rows || []).length > 0;
        }
        // mysql / mysql2
        const [rows] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ? AND TABLE_SCHEMA = DATABASE()", [table, column]);
        return (rows || []).length > 0;
    } catch (e) {
        return false;
    }
}

// Create new sale with items
exports.createSale = async (req, res) => {
    const connection = await db.getConnection();

    try {
        // Debug log to help diagnose why POST /api/sales might 500 in some environments.
        // This prints the authenticated user and request body to the server console (safe for local debugging).
        console.error('createSale invoked - user/payload:', {
            user: req.user, bodySummary: {
                customer_name: req.body && req.body.customer_name,
                customer_phone: req.body && req.body.customer_phone,
                items_count: req.body && Array.isArray(req.body.items) ? req.body.items.length : 0,
                payment_status: req.body && req.body.payment_status
            }
        });
        await connection.beginTransaction();

        const { customer_name, customer_phone, customer_address, items, payment_status, payment_method } = req.body;

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

        // Detect whether sales.payment_method column exists
        let hasPaymentMethod = false;
        try {
            hasPaymentMethod = await hasColumn('sales', 'payment_method');
        } catch (e) {
            hasPaymentMethod = false;
        }

        let saleResult;
        if (hasPaymentMethod) {
            [saleResult] = await connection.query(
                'INSERT INTO sales (customer_id, staff_id, total_amount, payment_status, payment_date, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
                [customerId, req.user.id, totalAmount, payment_status, paymentDate, payment_method || null]
            );
        } else {
            [saleResult] = await connection.query(
                'INSERT INTO sales (customer_id, staff_id, total_amount, payment_status, payment_date) VALUES (?, ?, ?, ?, ?)',
                [customerId, req.user.id, totalAmount, payment_status, paymentDate]
            );
        }

        const saleId = saleResult.insertId || saleResult.lastID || saleResult.insertedId || null;

        // Insert sale items — detect if sale_items.description and total_pieces exist to avoid schema errors
        let hasDescriptionCol = false;
        let hasTotalPiecesCol = false;
        try {
            if (db.type === 'sqlite') {
                const [info] = await db.query("SELECT * FROM pragma_table_info('sale_items')");
                const names = (info || []).map(r => r.name);
                hasDescriptionCol = names.includes('description');
                hasTotalPiecesCol = names.includes('total_pieces');
            } else if (db.type === 'postgres') {
                const [rows] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name IN ('description', 'total_pieces')");
                const names = (rows || []).map(r => r.column_name);
                hasDescriptionCol = names.includes('description');
                hasTotalPiecesCol = names.includes('total_pieces');
            } else if (db.type === 'mysql') {
                const [rows] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale_items' AND COLUMN_NAME IN ('description', 'total_pieces') AND TABLE_SCHEMA = DATABASE()");
                const names = (rows || []).map(r => r.COLUMN_NAME);
                hasDescriptionCol = names.includes('description');
                hasTotalPiecesCol = names.includes('total_pieces');
            } else {
                // conservative default: assume column exists
                hasDescriptionCol = true;
                hasTotalPiecesCol = true;
            }
        } catch (e) {
            // ignore and assume no columns available
            hasDescriptionCol = false;
            hasTotalPiecesCol = false;
        }

        for (const item of items) {
            // Construct the columns and values dynamically to handle combinations of description/total_pieces
            let cols = ['sale_id', 'service_id', 'item_type', 'quantity', 'unit_price', 'subtotal'];
            let vals = [saleId, item.service_id, item.item_type, item.quantity, item.unit_price, item.subtotal];
            let placeholders = ['?', '?', '?', '?', '?', '?'];

            if (hasDescriptionCol) {
                cols.push('description');
                vals.push(item.description || null);
                placeholders.push('?');
            }
            if (hasTotalPiecesCol) {
                cols.push('total_pieces');
                vals.push(item.total_pieces || 1);
                placeholders.push('?');
            }

            const sql = `INSERT INTO sale_items (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
            await connection.query(sql, vals);
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
        const resp = { error: 'Failed to create sale' };
        // When DEBUG=true in env, return the server error message to help debugging (safe for dev only)
        if (process.env.DEBUG === 'true') {
            resp.server_error = error.message;
            resp.stack = error.stack;
        }
        res.status(500).json(resp);
    } finally {
        connection.release();
    }
};

// Get today's sales total
exports.getDailySales = async (req, res) => {
    try {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const [result] = await db.query(
            `SELECT 
                COUNT(*) as total_sales,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) as unpaid_amount
            FROM sales 
            WHERE DATE(created_at) = ?`,
            [todayStr]
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
        // Build a safe SELECT that only references user.address / user.phone if those columns exist in the DB
        let sales;
        try {
            const hasUserAddress = await hasColumn('users', 'address');
            const hasUserPhone = await hasColumn('users', 'phone');

            let userCols = 'u.full_name as staff_name';
            if (hasUserAddress) userCols += ', u.address as staff_address';
            if (hasUserPhone) userCols += ', u.phone as staff_phone';

            const sql = `SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, ${userCols}
                    FROM sales s
                    JOIN customers c ON s.customer_id = c.id
                    JOIN users u ON s.staff_id = u.id
                    WHERE s.id = ?`;
            const [rows] = await db.query(sql, [saleId]);
            sales = rows;
        } catch (err) {
            // Fallback to a minimal select if anything goes wrong
            const [rows] = await db.query(
                `SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
                    FROM sales s
                    JOIN customers c ON s.customer_id = c.id
                    WHERE s.id = ?`,
                [saleId]
            );
            sales = rows;
        }

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
        const { payment_status, payment_method } = req.body;

        if (!['paid', 'unpaid'].includes(payment_status)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }

        const paymentDate = payment_status === 'paid' ? new Date().toISOString() : null;

        // Try to update payment_method if column exists; fall back if not
        try {
            const hasPaymentMethodCol = await hasColumn('sales', 'payment_method');
            if (hasPaymentMethodCol) {
                await db.query('UPDATE sales SET payment_status = ?, payment_date = ?, payment_method = ? WHERE id = ?', [payment_status, paymentDate, payment_method || null, saleId]);
            } else {
                await db.query('UPDATE sales SET payment_status = ?, payment_date = ? WHERE id = ?', [payment_status, paymentDate, saleId]);
            }
        } catch (e) {
            // fallback to basic update
            await db.query('UPDATE sales SET payment_status = ?, payment_date = ? WHERE id = ?', [payment_status, paymentDate, saleId]);
        }

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
                   (SELECT SUM(COALESCE(si.total_pieces, si.quantity, 1)) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
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
