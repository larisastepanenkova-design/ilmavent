const cron = require('node-cron');
const config = require('../config');
const { getDb } = require('../db/database');
const { getAllManagers } = require('../db/managers');

let botInstance = null;

/**
 * Подключить бота для отправки отчётов
 */
function setBotInstance(bot) {
    botInstance = bot;
}

/**
 * Сгенерировать отчёт за период
 */
function generateReport(periodLabel, daysBack) {
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceStr = since.toISOString();

    // Общая статистика по заявкам
    const totalLeads = db.prepare(
        "SELECT COUNT(*) as c FROM leads WHERE created_at >= ?"
    ).get(sinceStr);

    const takenLeads = db.prepare(
        "SELECT COUNT(*) as c FROM leads WHERE taken_at IS NOT NULL AND created_at >= ?"
    ).get(sinceStr);

    const redLeads = db.prepare(
        "SELECT COUNT(*) as c FROM leads WHERE color = 'red' AND created_at >= ?"
    ).get(sinceStr);

    // Статистика по менеджерам
    const managers = getAllManagers();
    const managerStats = managers.map(m => {
        const taken = db.prepare(
            "SELECT COUNT(*) as c FROM leads WHERE taken_by = ? AND taken_at >= ?"
        ).get(m.id, sinceStr);

        const red = db.prepare(
            "SELECT COUNT(*) as c FROM leads WHERE taken_by = ? AND color = 'red' AND created_at >= ?"
        ).get(m.id, sinceStr);

        const redZones = db.prepare(
            "SELECT COUNT(*) as c FROM history WHERE manager_id = ? AND event_type = 'red_zone' AND created_at >= ?"
        ).get(m.id, sinceStr);

        return {
            name: m.name,
            taken: taken.c,
            red: red.c,
            redZones: redZones.c,
            isBlocked: m.is_blocked,
            isPaused: m.is_paused,
        };
    });

    // Сортируем: больше всего взял → первый
    managerStats.sort((a, b) => b.taken - a.taken);

    // Формируем текст отчёта
    const lines = [
        `📊 <b>Отчёт: ${periodLabel}</b>`,
        ``,
        `📩 Всего заявок: <b>${totalLeads.c}</b>`,
        `✅ Взято в работу: <b>${takenLeads.c}</b>`,
        `🔴 Просрочено: <b>${redLeads.c}</b>`,
        ``,
        `👥 <b>По менеджерам:</b>`,
    ];

    managerStats.forEach((m, i) => {
        let status = '';
        if (m.isBlocked) status = ' 🚫';
        else if (m.isPaused) status = ' ⏸';

        const medal = i === 0 && m.taken > 0 ? '🥇 ' : '';
        lines.push(
            `${medal}<b>${m.name}</b>${status}: ${m.taken} заявок` +
            (m.red > 0 ? `, 🔴 ${m.red} просрочено` : '') +
            (m.redZones > 0 ? `, ⚠️ ${m.redZones} попаданий в красную зону` : '')
        );
    });

    // Средняя скорость
    const avgTime = db.prepare(`
        SELECT AVG((julianday(taken_at) - julianday(created_at)) * 24 * 60) as avg_min
        FROM leads WHERE taken_at IS NOT NULL AND created_at >= ?
    `).get(sinceStr);

    if (avgTime.avg_min) {
        const mins = Math.round(avgTime.avg_min);
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        lines.push('');
        lines.push(`⏱ Среднее время взятия: <b>${hours > 0 ? hours + 'ч ' : ''}${remMins}мин</b>`);
    }

    return lines.join('\n');
}

/**
 * Отправить отчёт в канал
 */
async function sendReport(text) {
    if (!botInstance || !config.telegram.channelId) {
        console.log('⚠️ Отчёт не отправлен: бот или канал не настроен');
        return;
    }

    try {
        await botInstance.telegram.sendMessage(
            config.telegram.channelId,
            text,
            { parse_mode: 'HTML' }
        );
        console.log('📊 Отчёт отправлен в Telegram');
    } catch (err) {
        console.error('❌ Ошибка отправки отчёта:', err.message);
    }
}

/**
 * Запустить крон-задачи для отчётов
 */
function startReportSchedule() {
    // Еженедельный отчёт — каждый понедельник в 09:00
    cron.schedule('0 9 * * 1', async () => {
        console.log('📊 Генерация еженедельного отчёта...');
        const report = generateReport('Неделя', 7);
        await sendReport(report);
    });

    // Ежемесячный отчёт — 1-е число каждого месяца в 09:00
    cron.schedule('0 9 1 * *', async () => {
        console.log('📊 Генерация ежемесячного отчёта...');
        const report = generateReport('Месяц', 30);
        await sendReport(report);
    });

    console.log('📊 Отчёты: пн 09:00 (неделя), 1-е число 09:00 (месяц)');
}

module.exports = { generateReport, sendReport, startReportSchedule, setBotInstance };
