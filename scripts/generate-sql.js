const fs = require('fs');
const path = require('path');

const p = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/data/pricelist.json'), 'utf8'));
const sqlData = JSON.stringify(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const sql = `UPDATE pricelist_data SET data = '${sqlData}', updated_at = NOW();\n`;

fs.writeFileSync(path.join(__dirname, 'update-live-pricelist.sql'), sql, 'utf8');
console.log('✓ Generated scripts/update-live-pricelist.sql');

