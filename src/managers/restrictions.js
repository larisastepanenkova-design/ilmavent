const config = require('../config');
const { getDb } = require('../db/database');
const { getRedTaskCount, isBlocked, incrementRedZone, blockManager } = require('../db/managers');
const { logEvent } = require('../db/history');

/**
 * Проверить, может ли менеджер взять заявку
 * Возвращает { allowed: true } или { allowed: false, reason: '...' }
 */
function canTakeLead(managerId) {
    // 1. Проверка блокировки
    const blockStatus = isBlocked(managerId);
    if (blockStatus.blocked) {
        return {
            allowed: false,
            reason: `🚫 Вы заблокированы: ${blockStatus.reason}${blockStatus.until ? `\nДо: ${new Date(blockStatus.until).toLocaleDateString('ru-RU')}` : ''}`,
        };
    }

    // 2. Проверка паузы (отпуск)
    const { getManagerById } = require('../db/managers');
    const manager = getManagerById(managerId);
    if (manager && manager.is_paused) {
        return {
            allowed: false,
            reason: '⏸ Вы сейчас на паузе. Обратитесь к администратору.',
        };
    }

    // 3. Проверка количества красных задач
    const redCount = getRedTaskCount(managerId);
    if (redCount > config.limits.maxRedTasks) {
        return {
            allowed: false,
            reason: `🔴 У вас ${redCount} просроченных заявок (максимум ${config.limits.maxRedTasks}).\nЗакройте задачи, чтобы брать новые.`,
        };
    }

    return { allowed: true };
}

/**
 * Обработать попадание в красную зону
 * Вызывается таймером при переходе заявки в красный
 */
function handleRedZone(managerId, leadId) {
    const count = incrementRedZone(managerId);
    logEvent(managerId, 'red_zone', leadId, `Попадание #${count} в красную зону`);

    // Если 3+ раза — автоблокировка
    if (count >= config.limits.redZoneStrikes) {
        blockManager(managerId, `Автоблокировка: ${count} попаданий в красную зону`, config.limits.blockDurationDays);
        logEvent(managerId, 'block', leadId, `Автоблокировка на ${config.limits.blockDurationDays} дней`);
        return {
            blocked: true,
            message: `⛔ Менеджер заблокирован на ${config.limits.blockDurationDays} дней (${count} просрочек)`,
        };
    }

    return { blocked: false, count };
}

/**
 * Получить текущий час по московскому времени (UTC+3)
 */
function getMoscowHour() {
    const now = new Date();
    const moscowOffset = 3 * 60; // +3 часа в минутах
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const moscow = new Date(utc + (moscowOffset * 60000));
    return moscow.getHours();
}

/**
 * Проверка ночного режима
 * Заявки с 21:00 до 06:00 MSK не показываются менеджерам
 */
function isNightMode() {
    const hour = getMoscowHour();
    const start = config.nightMode.start;
    const end = config.nightMode.end;

    // Поддержка перехода через полночь (напр. 21:00–06:00)
    if (start > end) {
        return hour >= start || hour < end;
    }
    return hour >= start && hour < end;
}

module.exports = { canTakeLead, handleRedZone, isNightMode };
