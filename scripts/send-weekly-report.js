#!/usr/bin/env node
/**
 * Standalone Weekly Report Sender Script
 * 
 * Usage:
 *   node scripts/send-weekly-report.js
 *   node scripts/send-weekly-report.js --to=myemail@gmail.com
 * 
 * Can also be scheduled directly in cPanel Cron:
 *   0 8 * * 1 /usr/local/bin/node /path/to/universal-app/scripts/send-weekly-report.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const emailService = require('../server/services/emailService');

async function main() {
    console.log('🚀 Universal Wash — Weekly Report Dispatcher');
    console.log('--------------------------------------------------');

    // Parse command line arguments
    const args = process.argv.slice(2);
    let toArg = null;
    args.forEach(arg => {
        if (arg.startsWith('--to=')) {
            toArg = arg.split('=')[1];
        }
    });

    const recipient = toArg || process.env.ADMIN_REPORT_EMAIL;
    if (!recipient) {
        console.error('❌ Error: No recipient email provided. Set ADMIN_REPORT_EMAIL in .env or pass --to=email@domain.com');
        process.exit(1);
    }

    console.log(`📡 SMTP Server: ${process.env.SMTP_HOST || 'mail.universalwash.com.ng'}:${process.env.SMTP_PORT || '465'}`);
    console.log(`📤 Sending from: ${process.env.SMTP_USER || 'reports@universalwash.com.ng'}`);
    console.log(`📥 Sending to:   ${recipient}`);

    try {
        console.log('⏳ Gathering weekly performance data and generating report...');
        const result = await emailService.sendWeeklyReport({ to: recipient });
        console.log('🎉 Report successfully delivered!');
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Period:     ${result.period}`);
        console.log(`   Orders:     ${result.summary.total_orders}`);
        console.log(`   Collected:  ₦${result.summary.total_collected.toLocaleString()}`);
        console.log(`   Debts:      ₦${result.summary.total_outstanding.toLocaleString()}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to send weekly report:', err.message);
        process.exit(1);
    }
}

main();
