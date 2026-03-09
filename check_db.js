const db = require('./node_modules/better-sqlite3')('./ilmavent.db');
const rows = db.prepare('SELECT id, name, bitrix_user_id FROM managers').all();
console.log(JSON.stringify(rows, null, 2));
