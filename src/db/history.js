const { getDb } = require('./database');

/**
 * Записать событие в историю
 */
function logEvent(managerId, eventType, leadId, details) {
    const db = getDb();
    db.prepare(`
    INSERT INTO history (manager_id, event_type, lead_id, details)
    VALUES (?, ?, ?, ?)
  `).run(managerId, eventType, leadId || null, details || null);
}

/**
 * Получить историю менеджера
 */
function getManagerHistory(managerId, limit = 50) {
    const db = getDb();
    return db.prepare(`
    SELECT h.*, m.name as manager_name
    FROM history h
    JOIN managers m ON h.manager_id = m.id
    WHERE h.manager_id = ?
    ORDER BY h.created_at DESC
    LIMIT ?
  `).all(managerId, limit);
}

/**
 * Получить всю историю за период (для отчётов)
 */
function getHistoryForPeriod(fromDate, toDate) {
    const db = getDb();
    return db.prepare(`
    SELECT h.*, m.name as manager_name
    FROM history h
    JOIN managers m ON h.manager_id = m.id
    WHERE h.created_at >= ? AND h.created_at <= ?
    ORDER BY h.created_at DESC
  `).all(fromDate, toDate);
}

module.exports = { logEvent, getManagerHistory, getHistoryForPeriod };
