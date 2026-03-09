const db = require('./src/db/database');
db.initDatabase();
const { getLeadById, getNightLeads } = require('./src/db/leads');
[25, 26, 29, 33, 34].forEach(function (id) {
    var r = getLeadById(id);
    if (r) console.log('Lead #' + r.id + ': source=' + r.source + ' tg_msg=' + r.telegram_message_id + ' status=' + r.status);
});
var n = getNightLeads();
console.log('Night leads count: ' + n.length);
n.forEach(function (l) { console.log('  Night #' + l.id + ': ' + l.source + ' tg=' + l.telegram_message_id); });
