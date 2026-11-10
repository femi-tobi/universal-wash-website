let cron;
try {
    cron = require('node-cron');
} catch (e) {
    cron = null;
}
const emailService = require('./emailService');

let scheduledTask = null;

/**
 * Initializes the weekly report cron scheduler.
 * Runs every Monday at 08:00 AM.
 */
function init() {
    if (!cron) {
        console.warn('⚠️ node-cron is not installed on the server. Scheduled reports will be disabled until "Run NPM Install" is executed on cPanel.');
        return;
    }
    // Cron syntax: Minute (0), Hour (8), Day-of-month (*), Month (*), Day-of-week (1 = Monday)
    const scheduleExpr = process.env.WEEKLY_REPORT_CRON || '0 8 * * 1';

    try {
        scheduledTask = cron.schedule(scheduleExpr, async () => {
            console.log('⏰ [Cron] Triggering scheduled weekly business report email...');
            try {
                if (!process.env.ADMIN_REPORT_EMAIL) {
                    console.log('⚠️ [Cron] No ADMIN_REPORT_EMAIL configured in .env. Skipping automated email.');
                    return;
                }
                if (!process.env.SMTP_PASS || process.env.SMTP_PASS.includes('REPLACE_WITH')) {
                    console.log('⚠️ [Cron] No SMTP_PASS set in .env. Skipping automated email.');
                    return;
                }

                const result = await emailService.sendWeeklyReport();
                console.log('🎉 [Cron] Weekly report sent successfully to', result.recipient);
            } catch (err) {
                console.error('❌ [Cron] Error sending scheduled weekly report:', err.message);
            }
        });

        console.log(`⏱️ Weekly Report Scheduler registered: runs on schedule "${scheduleExpr}" (Every Monday at 08:00 AM)`);
    } catch (e) {
        console.error('Failed to initialize weekly report scheduler:', e.message);
    }
}

module.exports = {
    init,
    getTask: () => scheduledTask
};
