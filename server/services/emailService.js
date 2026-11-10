let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}
const db = require('../config/database');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Creates and returns the nodemailer transporter configured with cPanel SMTP
 */
function createTransporter() {
    if (!nodemailer) {
        throw new Error('Nodemailer is not installed on the server. Please click "Run NPM Install" in your cPanel Node.js selector.');
    }
    const host = process.env.SMTP_HOST || 'mail.universalwash.com.ng';
    const port = parseInt(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER || 'reports@universalwash.com.ng';
    const pass = process.env.SMTP_PASS;
    const isSecure = port === 465;

    return nodemailer.createTransport({
        host: host,
        port: port,
        secure: isSecure,
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            // Essential for shared cPanel hosting certificates
            rejectUnauthorized: false
        }
    });
}

/**
 * Test SMTP connection
 */
async function verifyConnection() {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return { success: true, message: 'SMTP connection verified successfully!' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Format currency helper (NGN)
 */
function formatNgn(num) {
    return '₦' + Number(num || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Helper: check whether a table has a given column across DBs
 */
async function hasColumn(table, column) {
    try {
        if (db.type === 'sqlite') {
            const [info] = await db.query(`SELECT * FROM pragma_table_info('${table}')`);
            const names = (info || []).map(r => r.name);
            return names.includes(column);
        }
        if (db.type === 'postgres') {
            const [rows] = await db.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
                [table, column]
            );
            return (rows || []).length > 0;
        }
        // MySQL / MariaDB
        const [rows] = await db.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ? AND TABLE_SCHEMA = DATABASE()",
            [table, column]
        );
        return (rows || []).length > 0;
    } catch (e) {
        return false;
    }
}

/**
 * Ensures payment_method column exists in the sales table
 */
async function ensurePaymentMethodColumn() {
    try {
        const exists = await hasColumn('sales', 'payment_method');
        if (!exists) {
            await db.query("ALTER TABLE sales ADD COLUMN payment_method VARCHAR(50) DEFAULT NULL");
            console.log('✅ Added missing payment_method column to sales table');
        }
    } catch (err) {
        // Silently continue if ALTER is restricted or column already present
    }
}

/**
 * Queries database to aggregate weekly metrics
 */
async function fetchWeeklyReportData(startDate, endDate) {
    // Attempt auto-migration for payment_method column
    await ensurePaymentMethodColumn();

    // Default to last 7 days if not provided
    let dateFilter = 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    let params = [];

    if (startDate && endDate) {
        dateFilter = 'DATE(created_at) BETWEEN ? AND ?';
        params = [startDate, endDate];
    }

    // 1. Overall Financial & Orders Summary
    const summarySql = `
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_amount), 0) as total_billed,
            COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount WHEN payment_status = 'partpaid' THEN amount_paid ELSE 0 END), 0) as total_collected,
            COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount WHEN payment_status = 'partpaid' THEN total_amount - amount_paid ELSE 0 END), 0) as total_outstanding,
            COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
            COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as unpaid_orders,
            COUNT(CASE WHEN payment_status = 'partpaid' THEN 1 END) as partpaid_orders
        FROM sales
        WHERE ${dateFilter}
    `;
    const [summaryRows] = await db.query(summarySql, params);
    const summary = summaryRows[0] || {
        total_orders: 0, total_billed: 0, total_collected: 0, total_outstanding: 0,
        paid_orders: 0, unpaid_orders: 0, partpaid_orders: 0
    };

    // 2. Staff Breakdown
    let staffRows = [];
    try {
        const staffSql = `
            SELECT 
                u.id as staff_id,
                COALESCE(u.full_name, u.username, 'Staff') as staff_name,
                u.username,
                COUNT(s.id) as order_count,
                COALESCE(SUM(s.total_amount), 0) as billed_amount,
                COALESCE(SUM(CASE WHEN s.payment_status = 'paid' THEN s.total_amount WHEN s.payment_status = 'partpaid' THEN s.amount_paid ELSE 0 END), 0) as collected_amount,
                COALESCE(SUM(CASE WHEN s.payment_status = 'unpaid' THEN s.total_amount WHEN s.payment_status = 'partpaid' THEN s.total_amount - s.amount_paid ELSE 0 END), 0) as unpaid_amount
            FROM sales s
            LEFT JOIN users u ON s.staff_id = u.id
            WHERE ${dateFilter.replace(/created_at/g, 's.created_at')}
            GROUP BY u.id, u.full_name, u.username
            ORDER BY collected_amount DESC
        `;
        const [rows] = await db.query(staffSql, params);
        staffRows = rows || [];
    } catch (e) {
        console.warn('Staff breakdown query failed:', e.message);
    }

    // 3. Payment Methods Distribution (safely handled with or without payment_method column)
    let paymentRows = [];
    try {
        const hasPaymentMethod = await hasColumn('sales', 'payment_method');
        if (hasPaymentMethod) {
            const paymentSql = `
                SELECT 
                    COALESCE(NULLIF(TRIM(payment_method), ''), 'Cash / Direct') as method,
                    COUNT(*) as count,
                    COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount WHEN payment_status = 'partpaid' THEN amount_paid ELSE 0 END), 0) as total
                FROM sales
                WHERE ${dateFilter}
                GROUP BY payment_method
                ORDER BY total DESC
            `;
            const [rows] = await db.query(paymentSql, params);
            paymentRows = rows || [];
        } else {
            const paymentSql = `
                SELECT 
                    'Standard / Cash' as method,
                    COUNT(*) as count,
                    COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount WHEN payment_status = 'partpaid' THEN amount_paid ELSE 0 END), 0) as total
                FROM sales
                WHERE ${dateFilter}
            `;
            const [rows] = await db.query(paymentSql, params);
            paymentRows = rows || [];
        }
    } catch (e) {
        console.warn('Payment methods distribution query failed:', e.message);
        paymentRows = [];
    }

    // 4. Garment Count & Top Services
    let totalGarments = 0;
    try {
        const garmentSql = `
            SELECT 
                COALESCE(SUM(si.quantity), 0) as total_garments
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE ${dateFilter.replace(/created_at/g, 's.created_at')}
        `;
        const [garmentRows] = await db.query(garmentSql, params);
        totalGarments = garmentRows[0]?.total_garments || 0;
    } catch (e) {
        console.warn('Garment count query failed:', e.message);
        totalGarments = 0;
    }

    let topServices = [];
    try {
        const topServicesSql = `
            SELECT 
                COALESCE(srv.name, si.item_type, 'Service') as service_name,
                COALESCE(SUM(si.quantity), 0) as total_pieces,
                COALESCE(SUM(si.subtotal), 0) as total_amount
            FROM sale_items si
            LEFT JOIN services srv ON si.service_id = srv.id
            JOIN sales s ON si.sale_id = s.id
            WHERE ${dateFilter.replace(/created_at/g, 's.created_at')}
            GROUP BY srv.name, si.item_type
            ORDER BY total_pieces DESC
            LIMIT 6
        `;
        const [rows] = await db.query(topServicesSql, params);
        topServices = rows || [];
    } catch (e) {
        console.warn('Top services query failed:', e.message);
        topServices = [];
    }

    return {
        summary,
        staffList: staffRows,
        paymentMethods: paymentRows,
        totalGarments,
        topServices
    };
}

/**
 * Builds the branded, responsive HTML template for the weekly report email
 */
function buildWeeklyReportHtml(data, periodLabel) {
    const s = data.summary;
    const appUrl = process.env.APP_URL || 'http://universalwash.com.ng';

    let staffRowsHtml = '';
    if (data.staffList && data.staffList.length > 0) {
        data.staffList.forEach(st => {
            staffRowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${st.staff_name}</td>
                    <td style="padding: 10px 12px; text-align: center; color: #64748b;">${st.order_count}</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #16a34a;">${formatNgn(st.collected_amount)}</td>
                    <td style="padding: 10px 12px; text-align: right; color: ${st.unpaid_amount > 0 ? '#dc2626' : '#64748b'}; font-weight: ${st.unpaid_amount > 0 ? '700' : 'normal'};">
                        ${formatNgn(st.unpaid_amount)}
                    </td>
                </tr>
            `;
        });
    } else {
        staffRowsHtml = `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8;">No staff sales recorded for this period.</td></tr>`;
    }

    let paymentMethodsHtml = '';
    if (data.paymentMethods && data.paymentMethods.length > 0) {
        data.paymentMethods.forEach(pm => {
            const methodLabel = (pm.method || 'cash').toUpperCase();
            paymentMethodsHtml += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; color: #334155; font-size: 13px;">💳 ${methodLabel} (${pm.count} orders)</span>
                    <span style="font-weight: 700; color: #0f172a; font-size: 14px;">${formatNgn(pm.total)}</span>
                </div>
            `;
        });
    }

    let topServicesHtml = '';
    if (data.topServices && data.topServices.length > 0) {
        data.topServices.forEach(ts => {
            topServicesHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 12px; font-weight: 500; color: #334155;">${ts.service_name}</td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #2563eb;">${ts.total_pieces} pcs</td>
                    <td style="padding: 8px 12px; text-align: right; color: #0f172a;">${formatNgn(ts.total_amount)}</td>
                </tr>
            `;
        });
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Wash - Weekly Business Performance Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 640px; margin: 24px auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 32px 28px; text-align: center; color: #ffffff;">
            <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; margin-bottom: 6px;">Universal Wash Laundry</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Weekly Performance Report</h1>
            <div style="font-size: 13px; opacity: 0.9; margin-top: 6px; background: rgba(255,255,255,0.15); display: inline-block; padding: 4px 14px; border-radius: 20px;">
                🗓️ ${periodLabel}
            </div>
        </div>

        <div style="padding: 28px;">

            <!-- KPI Cards Grid -->
            <div style="display: table; width: 100%; margin-bottom: 24px;">
                <div style="display: table-row;">
                    <div style="display: table-cell; width: 50%; padding-right: 8px; vertical-align: top;">
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 16px;">
                            <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Total Collected</div>
                            <div style="font-size: 22px; font-weight: 800; color: #15803d; margin-top: 4px;">${formatNgn(s.total_collected)}</div>
                            <div style="font-size: 11px; color: #166534; margin-top: 2px;">Cash, POS &amp; Transfer received</div>
                        </div>
                    </div>
                    <div style="display: table-cell; width: 50%; padding-left: 8px; vertical-align: top;">
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 18px 16px;">
                            <div style="font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Outstanding / Owings</div>
                            <div style="font-size: 22px; font-weight: 800; color: #dc2626; margin-top: 4px;">${formatNgn(s.total_outstanding)}</div>
                            <div style="font-size: 11px; color: #991b1b; margin-top: 2px;">Pending customer balances</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Volume Highlights -->
            <div style="display: table; width: 100%; margin-bottom: 28px;">
                <div style="display: table-row;">
                    <div style="display: table-cell; width: 33.33%; padding-right: 6px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Total Orders</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${s.total_orders}</div>
                        </div>
                    </div>
                    <div style="display: table-cell; width: 33.33%; padding: 0 3px;">
                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 11px; color: #1e40af; font-weight: 600;">Garments Handled</div>
                            <div style="font-size: 18px; font-weight: 800; color: #2563eb; margin-top: 2px;">${data.totalGarments} pcs</div>
                        </div>
                    </div>
                    <div style="display: table-cell; width: 33.33%; padding-left: 6px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Total Billed</div>
                            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${formatNgn(s.total_billed)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Staff Performance Section -->
            <div style="margin-bottom: 28px;">
                <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #2563eb; display: inline-block; padding-bottom: 4px;">
                    👥 Staff Sales Breakdown
                </h3>
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                        <thead>
                            <tr style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">
                                <th style="padding: 8px 12px;">Staff Member</th>
                                <th style="padding: 8px 12px; text-align: center;">Orders</th>
                                <th style="padding: 8px 12px; text-align: right;">Collected</th>
                                <th style="padding: 8px 12px; text-align: right;">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staffRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Payment Channels & Top Services (Two Column) -->
            <div style="margin-bottom: 28px;">
                <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #2563eb; display: inline-block; padding-bottom: 4px;">
                    💳 Payment Channels Collected
                </h3>
                ${paymentMethodsHtml || '<p style="color:#94a3b8;font-size:13px;">No payments recorded.</p>'}
            </div>

            ${topServicesHtml ? `
            <div style="margin-bottom: 28px;">
                <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #2563eb; display: inline-block; padding-bottom: 4px;">
                    🧺 Top Garments &amp; Services Processed
                </h3>
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase;">
                                <th style="padding: 8px 12px; text-align: left;">Item / Service</th>
                                <th style="padding: 8px 12px; text-align: center;">Pieces</th>
                                <th style="padding: 8px 12px; text-align: right;">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topServicesHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0 12px 0;">
                <a href="${appUrl}/views/admin/dashboard.html"
                   style="background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
                    📊 Open Admin Dashboard
                </a>
            </div>

        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b;">
            <p style="margin: 0 0 4px 0;">This automated weekly performance report was generated by <strong>Universal Wash System</strong>.</p>
            <p style="margin: 0; color: #94a3b8;">Sent from ${process.env.SMTP_USER || 'reports@universalwash.com.ng'} to ${process.env.ADMIN_REPORT_EMAIL || 'Administrator'}</p>
        </div>

    </div>
</body>
</html>
    `;
}

/**
 * Sends the weekly report email
 */
async function sendWeeklyReport(options = {}) {
    const to = options.to || process.env.ADMIN_REPORT_EMAIL;
    if (!to) {
        throw new Error('No recipient email configured. Please set ADMIN_REPORT_EMAIL in .env or pass a recipient email address.');
    }

    const pass = process.env.SMTP_PASS;
    if (!pass || pass.trim() === '' || pass.includes('REPLACE_WITH')) {
        throw new Error('SMTP password is not configured in .env. Please add SMTP_PASS with your email password.');
    }

    const startDate = options.startDate || null;
    const endDate = options.endDate || null;

    let periodLabel = 'Past 7 Days';
    if (startDate && endDate) {
        periodLabel = `${startDate} to ${endDate}`;
    } else {
        const endD = new Date();
        const startD = new Date();
        startD.setDate(endD.getDate() - 7);
        periodLabel = `${startD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${endD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    // 1. Fetch data
    const data = await fetchWeeklyReportData(startDate, endDate);

    // 2. Build HTML
    const html = buildWeeklyReportHtml(data, periodLabel);

    // 3. Send email via SMTP
    const transporter = createTransporter();
    const senderEmail = process.env.SMTP_USER || 'reports@universalwash.com.ng';
    const fromAddress = `"Universal Wash" <${senderEmail}>`;

    const plainText = `
Universal Wash - Weekly Performance Report
Period: ${periodLabel}
--------------------------------------------------
Total Collected: ${formatNgn(data.summary.total_collected)}
Total Billed:    ${formatNgn(data.summary.total_billed)}
Total Orders:    ${data.summary.total_orders}
Total Garments:  ${data.totalGarments} pcs
Outstanding:     ${formatNgn(data.summary.total_outstanding)}

View the full interactive report in your Admin Dashboard:
${appUrl}/views/admin/dashboard.html
--------------------------------------------------
Universal Wash System - reports@universalwash.com.ng
`.trim();

    const info = await transporter.sendMail({
        from: fromAddress,
        to: to,
        replyTo: senderEmail,
        subject: `📊 Universal Wash - Weekly Performance Report (${periodLabel})`,
        text: plainText,
        html: html
    });

    console.log(`✅ Weekly report email successfully sent to ${to} (Message ID: ${info.messageId})`);

    return {
        success: true,
        messageId: info.messageId,
        recipient: to,
        period: periodLabel,
        summary: data.summary
    };
}

module.exports = {
    createTransporter,
    verifyConnection,
    fetchWeeklyReportData,
    buildWeeklyReportHtml,
    sendWeeklyReport
};
