const db = require('./node_modules/better-sqlite3')('./ilmavent.db');
try {
    db.exec('ALTER TABLE managers ADD COLUMN is_paused INTEGER DEFAULT 0');
    console.log('OK: is_paused added');
} catch (e) {
    console.log(e.message);
}
