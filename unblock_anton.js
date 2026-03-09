const db = require('./src/db/database');
db.initDatabase();
const { unblockManager, getAllManagers } = require('./src/db/managers');

const managers = getAllManagers();
managers.forEach(function (m) {
    console.log('Manager #' + m.id + ': ' + m.name + ' blocked=' + m.is_blocked + ' until=' + m.blocked_until + ' reason=' + m.blocked_reason);
});

// Разблокировать Антона
const anton = managers.find(function (m) { return m.name.includes('Антон'); });
if (anton) {
    console.log('\nUnblocking ' + anton.name + ' (id=' + anton.id + ')...');
    unblockManager(anton.id);
    console.log('Done! ' + anton.name + ' is now unblocked.');
}
