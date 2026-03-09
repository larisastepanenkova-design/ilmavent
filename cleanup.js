const db = require('./node_modules/better-sqlite3')('./ilmavent.db');
db.pragma('foreign_keys = OFF');
db.prepare('DELETE FROM history WHERE lead_id <= 7').run();
db.prepare('DELETE FROM leads WHERE id <= 7').run();
db.pragma('foreign_keys = ON');
console.log('Тестовые заявки #1-7 удалены');
const leads = db.prepare('SELECT id, client_name, client_phone FROM leads ORDER BY id').all();
leads.forEach(l => console.log(`#${l.id} | ${l.client_name} | ${l.client_phone}`));
