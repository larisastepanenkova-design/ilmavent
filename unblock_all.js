const db = require('./src/db/database');
db.initDatabase();
const { unblockManager, getAllManagers } = require('./src/db/managers');
unblockManager(3);
unblockManager(4);
console.log('Done!');
getAllManagers().forEach(function (m) { console.log(m.name + ' blocked=' + m.is_blocked); });
