(async () => {
  const db = require('../server/config/database');
  await db.ready;
  try {
  const colsRes = await db.query("SELECT * FROM pragma_table_info('sales')");
  console.log('sales pragma raw:', colsRes);
  const cols = Array.isArray(colsRes[0]) ? colsRes[0] : colsRes[0];
  if (Array.isArray(cols)) console.log('sales cols:', cols.map(c => c.name));
  const siColsRes = await db.query("SELECT * FROM pragma_table_info('sale_items')");
  console.log('sale_items pragma raw:', siColsRes);
  const siCols = Array.isArray(siColsRes[0]) ? siColsRes[0] : siColsRes[0];
  if (Array.isArray(siCols)) console.log('sale_items cols:', siCols.map(c => c.name));
    const [last] = await db.query('SELECT * FROM sales ORDER BY id DESC LIMIT 1');
    console.log('last sale:', last[0]);
    if (last[0]) {
      const sid = last[0].id;
      const [items] = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [sid]);
      console.log('items for last sale:', items);
    }
  } catch (e) {
    console.error(e);
  }
})();
