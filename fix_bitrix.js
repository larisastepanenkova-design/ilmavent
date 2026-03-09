const db = require('./node_modules/better-sqlite3')('./ilmavent.db');
const updates = [
    { id: 1, bitrix: 21 },   // Арсений
    { id: 2, bitrix: 73 },   // Антон
    { id: 3, bitrix: 35 },   // Денис
    { id: 4, bitrix: 87 },   // Дмитрий
    { id: 5, bitrix: 123 },  // Александр
];
const stmt = db.prepare('UPDATE managers SET bitrix_user_id = ? WHERE id = ?');
for (const u of updates) {
    stmt.run(u.bitrix, u.id);
    console.log(`ID ${u.id} → Bitrix ${u.bitrix}`);
}
console.log('OK!');
