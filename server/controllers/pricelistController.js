var fs = require('fs');
var path = require('path');
var db = require('../config/database');

var PRICELIST_PATH = path.join(__dirname, '../data/pricelist.json');

/**
 * Ensures required database tables exist.
 */
async function ensureTables() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS pricelist_data (
                id INT PRIMARY KEY DEFAULT 1,
                data LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS price_approval_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                staff_id INT NOT NULL,
                proposed_data LONGTEXT NOT NULL,
                original_data LONGTEXT,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                notes TEXT,
                admin_notes TEXT,
                reviewed_by INT,
                reviewed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_staff_id (staff_id),
                INDEX idx_status (status)
            )
        `);
    } catch (err) {
        console.error('ensureTables error:', err.message);
    }
}

/**
 * Computes a detailed diff between an original price list and a proposed price list.
 */
function computeDiff(original, proposed) {
    if (typeof original === 'string') {
        try { original = JSON.parse(original); } catch (e) { original = {}; }
    }
    if (typeof proposed === 'string') {
        try { proposed = JSON.parse(proposed); } catch (e) { proposed = {}; }
    }

    var serviceLabels = ['Hanging', 'Pressing', 'Washing & Press', 'Pressing & Hang'];
    var changes = [];

    ['male', 'female'].forEach(gender => {
        var origItems = (original && original[gender]) || [];
        var propItems = (proposed && proposed[gender]) || [];
        var genderLabel = gender === 'male' ? 'Men' : 'Women';

        // Check modified or removed items
        origItems.forEach(function(origItem, oIdx) {
            var propItem = propItems[oIdx];
            if (!propItem) {
                changes.push({
                    gender: gender,
                    genderLabel: genderLabel,
                    item: origItem.name,
                    changeType: 'removed',
                    field: 'Item',
                    oldVal: origItem.name,
                    newVal: null,
                    description: `Removed item "${origItem.name}"`
                });
                return;
            }

            // Name change
            if (origItem.name !== propItem.name) {
                changes.push({
                    gender: gender,
                    genderLabel: genderLabel,
                    item: propItem.name,
                    field: 'Item Name',
                    oldVal: origItem.name,
                    newVal: propItem.name,
                    changeType: 'name_change',
                    description: `Renamed from "${origItem.name}" to "${propItem.name}"`
                });
            }

            // Base price change
            var oldBase = origItem.base !== undefined && origItem.base !== null && origItem.base !== '' ? Number(origItem.base) : null;
            var newBase = propItem.base !== undefined && propItem.base !== null && propItem.base !== '' ? Number(propItem.base) : null;
            if (oldBase !== newBase) {
                changes.push({
                    gender: gender,
                    genderLabel: genderLabel,
                    item: propItem.name || origItem.name,
                    field: 'Base Price',
                    oldVal: oldBase,
                    newVal: newBase,
                    diff: (newBase || 0) - (oldBase || 0),
                    changeType: 'price_modified',
                    description: `Base price changed from ₦${(oldBase || 0).toLocaleString()} to ₦${(newBase || 0).toLocaleString()}`
                });
            }

            // Service prices [0: Hanging, 1: Pressing, 2: Washing & Press, 3: Pressing & Hang]
            var origPrices = origItem.prices || [];
            var propPrices = propItem.prices || [];
            for (var i = 0; i < 4; i++) {
                var oldP = origPrices[i] !== undefined && origPrices[i] !== null && origPrices[i] !== '' ? Number(origPrices[i]) : null;
                var newP = propPrices[i] !== undefined && propPrices[i] !== null && propPrices[i] !== '' ? Number(propPrices[i]) : null;
                if (oldP !== newP) {
                    var diffVal = (newP || 0) - (oldP || 0);
                    changes.push({
                        gender: gender,
                        genderLabel: genderLabel,
                        item: propItem.name || origItem.name,
                        field: serviceLabels[i] || `Service ${i + 1}`,
                        oldVal: oldP,
                        newVal: newP,
                        diff: diffVal,
                        changeType: 'price_modified',
                        description: `${serviceLabels[i]} price changed from ₦${(oldP || 0).toLocaleString()} to ₦${(newP || 0).toLocaleString()}`
                    });
                }
            }
        });

        // Check for new items added
        if (propItems.length > origItems.length) {
            for (var j = origItems.length; j < propItems.length; j++) {
                var newItem = propItems[j];
                changes.push({
                    gender: gender,
                    genderLabel: genderLabel,
                    item: newItem.name,
                    changeType: 'added',
                    field: 'New Item',
                    newVal: newItem.base,
                    description: `Added new item "${newItem.name}" (Base: ₦${(newItem.base || 0).toLocaleString()})`
                });
            }
        }
    });

    // Check bulk discount rules
    var origBulk = (original && original.bulkDiscounts) || [];
    var propBulk = (proposed && proposed.bulkDiscounts) || [];
    if (JSON.stringify(origBulk) !== JSON.stringify(propBulk)) {
        changes.push({
            gender: 'general',
            genderLabel: 'General',
            item: 'Bulk Discounts',
            changeType: 'bulk_modified',
            field: 'Discount Rules',
            description: 'Bulk discount rules were updated'
        });
    }

    return changes;
}

/**
 * Helper to fetch the active price list for a given staff ID or fallback to master/file
 */
async function fetchCurrentPricelist(targetId) {
    await ensureTables();
    try {
        var result = await db.query('SELECT data FROM pricelist_data WHERE id = ?', [targetId]);
        if (!result[0] || result[0].length === 0) {
            result = await db.query('SELECT data FROM pricelist_data WHERE id = 1');
        }
        var rows = result[0];
        if (rows && rows.length > 0) {
            var data = rows[0].data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            return data;
        }
    } catch (e) {
        console.error('fetchCurrentPricelist db error:', e.message);
    }

    if (fs.existsSync(PRICELIST_PATH)) {
        try {
            var raw = fs.readFileSync(PRICELIST_PATH, 'utf8');
            return JSON.parse(raw);
        } catch (e) {}
    }
    return { male: [], female: [], bulkDiscounts: [] };
}

/**
 * GET /api/pricelist
 * Fetches the laundry items price list (male/female/bulks).
 */
exports.getPricelist = async function(req, res) {
    res.setHeader('X-Debug-Identify', 'THIS_IS_THE_CORRECT_PRICELIST_CONTROLLER');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        await ensureTables();
        let targetId = req.query.staff_id ? parseInt(req.query.staff_id) : (req.user ? req.user.id : 1);
        
        var result = await db.query('SELECT data FROM pricelist_data WHERE id = ?', [targetId]);
        if (!result[0] || result[0].length === 0) {
            result = await db.query('SELECT data FROM pricelist_data WHERE id = 1');
        }
        
        var rows = result[0];
        if (rows && rows.length > 0) {
            var data = rows[0].data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            return res.json(data);
        }
    } catch (dbErr) {
        console.error('DB pricelist read error:', dbErr.message);
    }

    try {
        if (fs.existsSync(PRICELIST_PATH)) {
            var raw = fs.readFileSync(PRICELIST_PATH, 'utf8');
            return res.json(JSON.parse(raw));
        }
    } catch (err) {
        console.error('File pricelist read error:', err);
    }

    res.status(500).json({ error: 'Price list not found in DB or File' });
};

/**
 * PUT /api/pricelist
 * Direct updates to the price list (Admin only).
 */
exports.updatePricelist = async function(req, res) {
    try {
        var body = req.body;
        if (!body || !body.male || !body.female) {
            return res.status(400).json({ error: 'Invalid price list format' });
        }
        var jsonStr = JSON.stringify(body);
        let targetId = req.query.staff_id ? parseInt(req.query.staff_id) : (req.user ? req.user.id : 1);
        
        await ensureTables();
        try {
            var checkResult = await db.query('SELECT id FROM pricelist_data WHERE id = ?', [targetId]);
            var existing = checkResult[0];
            
            if (existing && existing.length > 0) {
                await db.query('UPDATE pricelist_data SET data = ?, updated_at = NOW() WHERE id = ?', [jsonStr, targetId]);
            } else {
                await db.query('INSERT INTO pricelist_data (id, data) VALUES (?, ?)', [targetId, jsonStr]);
            }
        } catch (dbErr) {
            console.error('DB pricelist update error:', dbErr.message);
        }

        if (targetId === 1) {
            try {
                fs.writeFileSync(PRICELIST_PATH, JSON.stringify(body, null, 2), 'utf8');
            } catch (e) {}
        }

        res.json({ success: true, message: 'Price list updated successfully' });
    } catch (err) {
        console.error('Error writing pricelist:', err);
        res.status(500).json({ error: 'Failed to save price list' });
    }
};

/**
 * POST /api/pricelist/request
 * Staff submits a proposed price list for admin approval.
 */
exports.submitPriceRequest = async function(req, res) {
    try {
        await ensureTables();
        var staffId = req.user ? req.user.id : null;
        if (!staffId) {
            return res.status(401).json({ error: 'User authentication required' });
        }

        var proposedData = req.body.data;
        var notes = req.body.notes || '';

        if (!proposedData || !proposedData.male || !proposedData.female) {
            return res.status(400).json({ error: 'Invalid price list format submitted' });
        }

        // Fetch current active pricelist to store as original snapshot
        var originalData = await fetchCurrentPricelist(staffId);
        var diff = computeDiff(originalData, proposedData);

        if (diff.length === 0) {
            return res.status(400).json({ error: 'No price changes were detected compared to your active list.' });
        }

        var propJson = JSON.stringify(proposedData);
        var origJson = JSON.stringify(originalData);

        var result = await db.query(
            'INSERT INTO price_approval_requests (staff_id, proposed_data, original_data, notes, status) VALUES (?, ?, ?, ?, "pending")',
            [staffId, propJson, origJson, notes]
        );

        res.json({
            success: true,
            message: 'Price change request submitted successfully! Awaiting admin approval.',
            requestId: result[0]?.insertId,
            changesCount: diff.length
        });
    } catch (err) {
        console.error('submitPriceRequest error:', err);
        res.status(500).json({ error: 'Failed to submit price change request: ' + err.message });
    }
};

/**
 * GET /api/pricelist/my-requests
 * Staff retrieves their own submitted price approval requests.
 */
exports.getMyPriceRequests = async function(req, res) {
    try {
        await ensureTables();
        var staffId = req.user ? req.user.id : null;
        if (!staffId) {
            return res.status(401).json({ error: 'User authentication required' });
        }

        var result = await db.query(
            'SELECT id, staff_id, status, notes, admin_notes, created_at, reviewed_at, proposed_data, original_data FROM price_approval_requests WHERE staff_id = ? ORDER BY created_at DESC LIMIT 30',
            [staffId]
        );

        var requests = (result[0] || []).map(function(row) {
            var diff = computeDiff(row.original_data, row.proposed_data);
            return {
                id: row.id,
                staff_id: row.staff_id,
                status: row.status,
                notes: row.notes,
                admin_notes: row.admin_notes,
                created_at: row.created_at,
                reviewed_at: row.reviewed_at,
                changesCount: diff.length,
                changes: diff
            };
        });

        res.json(requests);
    } catch (err) {
        console.error('getMyPriceRequests error:', err);
        res.status(500).json({ error: 'Failed to load your price requests' });
    }
};

/**
 * GET /api/pricelist/my-pending-count
 * Returns whether staff has a pending price approval request.
 */
exports.getMyPendingCount = async function(req, res) {
    try {
        await ensureTables();
        var staffId = req.user ? req.user.id : null;
        if (!staffId) return res.json({ count: 0 });

        var result = await db.query(
            'SELECT COUNT(*) as cnt FROM price_approval_requests WHERE staff_id = ? AND status = "pending"',
            [staffId]
        );
        var count = result[0]?.[0]?.cnt || 0;
        res.json({ count: count });
    } catch (err) {
        res.json({ count: 0 });
    }
};

/**
 * GET /api/pricelist/requests
 * Admin retrieves all price change requests (with optional ?status=pending|approved|rejected).
 */
exports.getAllPriceRequests = async function(req, res) {
    try {
        await ensureTables();
        var statusFilter = req.query.status;
        var query = `
            SELECT r.id, r.staff_id, r.status, r.notes, r.admin_notes, r.created_at, r.reviewed_at,
                   r.proposed_data, r.original_data,
                   u.full_name as staff_name, u.username as staff_username, u.phone as staff_phone, u.address as staff_address,
                   rev.full_name as reviewer_name
            FROM price_approval_requests r
            JOIN users u ON r.staff_id = u.id
            LEFT JOIN users rev ON r.reviewed_by = rev.id
        `;
        var params = [];

        if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
            query += ' WHERE r.status = ?';
            params.push(statusFilter);
        }

        query += ' ORDER BY r.created_at DESC LIMIT 100';

        var result = await db.query(query, params);
        var requests = (result[0] || []).map(function(row) {
            var diff = computeDiff(row.original_data, row.proposed_data);
            return {
                id: row.id,
                staff_id: row.staff_id,
                staff_name: row.staff_name || row.staff_username || 'Staff',
                staff_username: row.staff_username,
                staff_phone: row.staff_phone,
                staff_address: row.staff_address,
                reviewer_name: row.reviewer_name,
                status: row.status,
                notes: row.notes,
                admin_notes: row.admin_notes,
                created_at: row.created_at,
                reviewed_at: row.reviewed_at,
                changesCount: diff.length,
                changes: diff
            };
        });

        res.json(requests);
    } catch (err) {
        console.error('getAllPriceRequests error:', err);
        res.status(500).json({ error: 'Failed to load price requests: ' + err.message });
    }
};

/**
 * GET /api/pricelist/requests/pending-count
 * Admin gets the total count of pending price requests.
 */
exports.getPendingRequestsCount = async function(req, res) {
    try {
        await ensureTables();
        var result = await db.query('SELECT COUNT(*) as cnt FROM price_approval_requests WHERE status = "pending"');
        var count = result[0]?.[0]?.cnt || 0;
        res.json({ count: count });
    } catch (err) {
        res.json({ count: 0 });
    }
};

/**
 * GET /api/pricelist/requests/:id
 * Retrieves full details for a single price approval request.
 */
exports.getPriceRequestDetails = async function(req, res) {
    try {
        await ensureTables();
        var id = parseInt(req.params.id);
        var query = `
            SELECT r.*,
                   u.full_name as staff_name, u.username as staff_username, u.phone as staff_phone, u.address as staff_address,
                   rev.full_name as reviewer_name
            FROM price_approval_requests r
            JOIN users u ON r.staff_id = u.id
            LEFT JOIN users rev ON r.reviewed_by = rev.id
            WHERE r.id = ?
        `;
        var result = await db.query(query, [id]);
        var rows = result[0];

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Price request not found' });
        }

        var reqRow = rows[0];

        // Access check: Only Admin or the requesting Staff can view
        if (req.user.role !== 'admin' && req.user.id !== reqRow.staff_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        var propData = typeof reqRow.proposed_data === 'string' ? JSON.parse(reqRow.proposed_data) : reqRow.proposed_data;
        var origData = typeof reqRow.original_data === 'string' ? JSON.parse(reqRow.original_data) : reqRow.original_data;
        var diff = computeDiff(origData, propData);

        res.json({
            id: reqRow.id,
            staff_id: reqRow.staff_id,
            staff_name: reqRow.staff_name || reqRow.staff_username,
            staff_username: reqRow.staff_username,
            staff_phone: reqRow.staff_phone,
            staff_address: reqRow.staff_address,
            reviewer_name: reqRow.reviewer_name,
            status: reqRow.status,
            notes: reqRow.notes,
            admin_notes: reqRow.admin_notes,
            created_at: reqRow.created_at,
            reviewed_at: reqRow.reviewed_at,
            proposed_data: propData,
            original_data: origData,
            changesCount: diff.length,
            changes: diff
        });
    } catch (err) {
        console.error('getPriceRequestDetails error:', err);
        res.status(500).json({ error: 'Failed to retrieve request details' });
    }
};

/**
 * POST /api/pricelist/requests/:id/approve
 * Admin approves a price change request and applies the new prices to the staff's price list.
 */
exports.approvePriceRequest = async function(req, res) {
    try {
        await ensureTables();
        var id = parseInt(req.params.id);
        var adminNotes = req.body.admin_notes || '';

        var reqResult = await db.query('SELECT * FROM price_approval_requests WHERE id = ?', [id]);
        var rows = reqResult[0];

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Price request not found' });
        }

        var request = rows[0];
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'This request has already been ' + request.status });
        }

        var staffId = request.staff_id;
        var proposedData = typeof request.proposed_data === 'string' ? JSON.parse(request.proposed_data) : request.proposed_data;
        var proposedDataStr = JSON.stringify(proposedData);

        // 1. Update staff's active pricelist in pricelist_data
        var checkResult = await db.query('SELECT id FROM pricelist_data WHERE id = ?', [staffId]);
        if (checkResult[0] && checkResult[0].length > 0) {
            await db.query('UPDATE pricelist_data SET data = ?, updated_at = NOW() WHERE id = ?', [proposedDataStr, staffId]);
        } else {
            await db.query('INSERT INTO pricelist_data (id, data) VALUES (?, ?)', [staffId, proposedDataStr]);
        }

        // 2. Also ensure master pricelist_data (id = 1) is updated if master doesn't exist yet or if staff 1
        if (staffId === 1) {
            try {
                fs.writeFileSync(PRICELIST_PATH, JSON.stringify(proposedData, null, 2), 'utf8');
            } catch (e) {}
        }

        // 2. Mark request as approved
        await db.query(
            'UPDATE price_approval_requests SET status = "approved", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE id = ?',
            [req.user.id, adminNotes, id]
        );

        res.json({
            success: true,
            message: 'Price changes approved! The updated prices are now live for this staff member.'
        });
    } catch (err) {
        console.error('approvePriceRequest error:', err);
        res.status(500).json({ error: 'Failed to approve price request: ' + err.message });
    }
};

/**
 * POST /api/pricelist/requests/:id/reject
 * Admin rejects a price change request. Live prices remain unchanged.
 */
exports.rejectPriceRequest = async function(req, res) {
    try {
        await ensureTables();
        var id = parseInt(req.params.id);
        var reason = req.body.reason || req.body.admin_notes || 'Price change request declined by admin.';

        var reqResult = await db.query('SELECT * FROM price_approval_requests WHERE id = ?', [id]);
        var rows = reqResult[0];

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Price request not found' });
        }

        var request = rows[0];
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'This request has already been ' + request.status });
        }

        await db.query(
            'UPDATE price_approval_requests SET status = "rejected", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE id = ?',
            [req.user.id, reason, id]
        );

        res.json({
            success: true,
            message: 'Price change request rejected. Existing staff prices remain intact.'
        });
    } catch (err) {
        console.error('rejectPriceRequest error:', err);
        res.status(500).json({ error: 'Failed to reject price request: ' + err.message });
    }
};
