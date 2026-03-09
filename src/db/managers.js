const { getDb } = require('./database');

/**
 * Получить всех менеджеров
 */
function getAllManagers() {
    const db = getDb();
    return db.prepare('SELECT * FROM managers').all();
}

/**
 * Найти менеджера по Telegram ID
 */
function getManagerByTelegramId(telegramId) {
    const db = getDb();
    return db.prepare('SELECT * FROM managers WHERE telegram_id = ?').get(telegramId);
}

/**
 * Найти менеджера по ID
 */
function getManagerById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM managers WHERE id = ?').get(id);
}

/**
 * Обновить Telegram ID менеджера (когда он первый раз напишет боту)
 */
function setTelegramId(managerId, telegramId) {
    const db = getDb();
    db.prepare('UPDATE managers SET telegram_id = ? WHERE id = ?').run(telegramId, managerId);
}

/**
 * Проверить, заблокирован ли менеджер
 */
function isBlocked(managerId) {
    const db = getDb();
    const manager = db.prepare('SELECT * FROM managers WHERE id = ?').get(managerId);

    if (!manager) return { blocked: true, reason: 'Менеджер не найден' };
    if (!manager.is_blocked) return { blocked: false };

    // Проверяем, не истёк ли срок блокировки
    if (manager.blocked_until) {
        const now = new Date();
        const until = new Date(manager.blocked_until);
        if (now >= until) {
            // Разблокируем
            unblockManager(managerId);
            return { blocked: false };
        }
        return {
            blocked: true,
            reason: manager.blocked_reason,
            until: manager.blocked_until,
        };
    }

    return { blocked: true, reason: manager.blocked_reason };
}

/**
 * Заблокировать менеджера
 */
function blockManager(managerId, reason, durationDays) {
    const db = getDb();
    const until = new Date();
    until.setDate(until.getDate() + durationDays);

    db.prepare(`
    UPDATE managers
    SET is_blocked = 1, blocked_until = ?, blocked_reason = ?
    WHERE id = ?
  `).run(until.toISOString(), reason, managerId);
}

/**
 * Разблокировать менеджера
 */
function unblockManager(managerId) {
    const db = getDb();
    db.prepare(`
    UPDATE managers
    SET is_blocked = 0, blocked_until = NULL, blocked_reason = NULL
    WHERE id = ?
  `).run(managerId);
}

/**
 * Увеличить счётчик красных зон
 */
function incrementRedZone(managerId) {
    const db = getDb();
    db.prepare(`
    UPDATE managers SET red_zone_count = red_zone_count + 1 WHERE id = ?
  `).run(managerId);

    // Вернуть текущее значение
    const manager = db.prepare('SELECT red_zone_count FROM managers WHERE id = ?').get(managerId);
    return manager.red_zone_count;
}

/**
 * Получить количество красных (просроченных) задач менеджера
 * Считаем заявки в статусе 'taken' с цветом 'red'
 */
function getRedTaskCount(managerId) {
    const db = getDb();
    const result = db.prepare(`
    SELECT COUNT(*) as count FROM leads
    WHERE taken_by = ? AND color = 'red' AND status = 'taken'
  `).get(managerId);
    return result.count;
}

module.exports = {
    getAllManagers,
    getManagerByTelegramId,
    getManagerById,
    setTelegramId,
    isBlocked,
    blockManager,
    unblockManager,
    incrementRedZone,
    getRedTaskCount,
};
