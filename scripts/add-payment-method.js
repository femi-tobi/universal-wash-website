(async ()=>{
  const db = require('../server/config/database');
  await db.ready;
  try {
    const [info] = await db.query("SELECT * FROM pragma_table_info('sales')");
    const cols = (info || []).map(r => r.name);
    console.log('cols before:', cols);
    if (!cols.includes('payment_method')) {
      console.log('Adding payment_method column');
      await db.query("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT NULL");
      const [info2] = await db.query("SELECT * FROM pragma_table_info('sales')");
      console.log('cols after:', (info2 || []).map(r => r.name));
    } else {
      console.log('payment_method already present');
    }
  } catch (e) {
    console.error('error', e);
  }
})();
