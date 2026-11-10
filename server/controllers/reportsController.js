const emailService = require('../services/emailService');

/**
 * GET /api/reports/config
 * Returns current report email configuration status (without sensitive pass)
 */
exports.getConfig = async (req, res) => {
    try {
        const hasPass = Boolean(process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('REPLACE_WITH'));
        res.json({
            configured: hasPass && Boolean(process.env.ADMIN_REPORT_EMAIL),
            host: process.env.SMTP_HOST || 'mail.universalwash.com.ng',
            port: process.env.SMTP_PORT || '465',
            senderEmail: process.env.SMTP_USER || 'reports@universalwash.com.ng',
            recipientEmail: process.env.ADMIN_REPORT_EMAIL || '',
            cronSchedule: process.env.WEEKLY_REPORT_CRON || '0 8 * * 1 (Every Monday at 08:00 AM)'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/reports/test-smtp
 * Tests SMTP connection to mail.universalwash.com.ng
 */
exports.testSmtp = async (req, res) => {
    try {
        const result = await emailService.verifyConnection();
        if (result.success) {
            res.json({ success: true, message: 'Connected to mail.universalwash.com.ng successfully!' });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/reports/preview-weekly
 * Previews the weekly report HTML in browser
 */
exports.previewWeeklyReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let periodLabel = 'Past 7 Days';
        if (startDate && endDate) {
            periodLabel = `${startDate} to ${endDate}`;
        } else {
            const endD = new Date();
            const startD = new Date();
            startD.setDate(endD.getDate() - 7);
            periodLabel = `${startD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${endD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }

        const data = await emailService.fetchWeeklyReportData(startDate, endDate);
        const html = emailService.buildWeeklyReportHtml(data, periodLabel);

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        console.error('Preview error:', err);
        res.status(500).send(`<h2>Error generating report preview</h2><p>${err.message}</p>`);
    }
};

/**
 * POST /api/reports/send-weekly
 * Triggers sending the weekly report to admin email or custom email
 */
exports.sendWeeklyReport = async (req, res) => {
    try {
        const targetEmail = req.body.email || process.env.ADMIN_REPORT_EMAIL;
        if (!targetEmail) {
            return res.status(400).json({
                error: 'No recipient email specified. Please provide a recipient email or set ADMIN_REPORT_EMAIL in .env'
            });
        }

        const result = await emailService.sendWeeklyReport({
            to: targetEmail,
            startDate: req.body.startDate,
            endDate: req.body.endDate
        });

        res.json({
            success: true,
            message: `Weekly report successfully sent to ${targetEmail}!`,
            details: result
        });
    } catch (err) {
        console.error('Send weekly report error:', err);
        res.status(500).json({ error: err.message });
    }
};
