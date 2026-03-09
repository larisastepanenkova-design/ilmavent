const { Markup } = require('telegraf');
const { getAllManagers, getManagerById, blockManager, unblockManager } = require('../db/managers');
const { getDb } = require('../db/database');
const { getRedTaskCount } = require('../db/managers');

// Директора — постоянные суперадмины (определяются по username)
const SUPER_ADMIN_USERNAMES = ['@VadimSelitskiy', '@Amosov_Sergey'];
const superAdminIds = new Set();

// Постоянные под-админы (определяются по username)
const SUB_ADMIN_USERNAMES = ['@IlmaMontazh'];

// Под-админы (назначаются директором + постоянные)
const subAdminIds = new Set();

// Все пользователи бота (для поиска под-админов среди не-менеджеров)
const botUsers = new Map(); // telegramId → { username, firstName }

/**
 * Запомнить пользователя бота (вызывается из /start)
 */
function trackBotUser(ctx) {
    botUsers.set(ctx.from.id, {
        username: ctx.from.username ? `@${ctx.from.username}` : null,
        firstName: ctx.from.first_name || 'Без имени',
    });
}

/**
 * Проверить, является ли пользователь суперадмином
 */
function isSuperAdmin(ctx) {
    const username = ctx.from.username ? `@${ctx.from.username}` : null;
    if (username && SUPER_ADMIN_USERNAMES.some(u => u.toLowerCase() === username.toLowerCase())) {
        superAdminIds.add(ctx.from.id);
        return true;
    }
    return superAdminIds.has(ctx.from.id);
}

/**
 * Проверить, является ли пользователь админом (супер или под)
 */
/**
 * Проверить, является ли пользователь админом (супер или под)
 */
function isAdmin(ctx) {
    if (isSuperAdmin(ctx)) return true;
    const username = ctx.from.username ? `@${ctx.from.username}` : null;
    if (username && SUB_ADMIN_USERNAMES.some(u => u.toLowerCase() === username.toLowerCase())) {
        subAdminIds.add(ctx.from.id);
        return true;
    }
    return subAdminIds.has(ctx.from.id);
}

// Ожидание ввода Bitrix ID (adminTelegramId → managerId)
const pendingBitrixId = new Map();

/**
 * Зарегистрировать админ-команды в боте
 */
function registerAdminCommands(bot) {

    // /admin — главное меню
    bot.command('admin', (ctx) => {
        if (ctx.chat.type !== 'private') {
            return ctx.reply('⚙️ Админ-панель доступна только в личных сообщениях боту.');
        }

        if (!isAdmin(ctx)) {
            return ctx.reply('🚫 У вас нет прав администратора.');
        }

        const buttons = [
            [Markup.button.callback('👥 Менеджеры', 'admin_managers')],
            [Markup.button.callback('📊 Статистика', 'admin_stats')],
            [Markup.button.callback('➕ Добавить менеджера', 'admin_add')],
        ];

        // Только суперадмин видит управление админами
        if (isSuperAdmin(ctx)) {
            buttons.push([Markup.button.callback('🔑 Под-админы', 'admin_subadmins')]);
        }

        return ctx.reply('⚙️ *Админ-панель Ilmavent*', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
        });
    });

    // Список менеджеров
    bot.action('admin_managers', (ctx) => {
        const managers = getAllManagers();
        const buttons = managers.map((m) => {
            let status = '✅';
            if (m.is_blocked) status = '🚫';
            else if (m.is_paused) status = '⏸';

            return [Markup.button.callback(`${m.name} ${status}`, `mgr_${m.id}`)];
        });

        buttons.push([Markup.button.callback('◀️ Назад', 'admin_back')]);

        ctx.editMessageText('👥 *Выберите менеджера:*', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
        });
    });

    // Карточка менеджера
    bot.action(/mgr_(\d+)/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        const manager = getManagerById(managerId);
        if (!manager) return ctx.answerCbQuery('Менеджер не найден');

        const redCount = getRedTaskCount(managerId);
        let statusText = '✅ Активен';
        if (manager.is_blocked) statusText = `🚫 Заблокирован${manager.blocked_reason ? ': ' + manager.blocked_reason : ''}`;
        else if (manager.is_paused) statusText = '⏸ На паузе';

        const db = getDb();
        const leadsCount = db.prepare("SELECT COUNT(*) as count FROM leads WHERE taken_by = ? AND status = 'taken'").get(managerId);

        const text = [
            `👤 *${manager.name}*`,
            `Telegram: ${(manager.telegram_username || '').replace(/_/g, '\\_')}`,
            `Bitrix ID: ${manager.bitrix_user_id || '❌ не привязан'}`,
            `Статус: ${statusText}`,
            `Заявок в работе: ${leadsCount.count}`,
            `Красных: ${redCount}`,
            `Попаданий в красную зону: ${manager.red_zone_count}`,
        ].join('\n');

        const buttons = [];

        if (manager.is_paused) {
            buttons.push([Markup.button.callback('▶️ Снять паузу', `unpause_${managerId}`)]);
        } else if (!manager.is_blocked) {
            buttons.push([Markup.button.callback('⏸ Пауза', `pause_${managerId}`)]);
        }

        if (manager.is_blocked) {
            buttons.push([Markup.button.callback('✅ Разблокировать', `unblock_${managerId}`)]);
        } else {
            buttons.push([Markup.button.callback('🚫 Заблокировать', `block_${managerId}`)]);
        }

        buttons.push([Markup.button.callback('🔗 Bitrix ID', `setbitrix_${managerId}`)]);
        buttons.push([Markup.button.callback('❌ Удалить', `delete_confirm_${managerId}`)]);
        buttons.push([Markup.button.callback('◀️ Назад', 'admin_managers')]);

        ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
        });
    });

    // Поставить на паузу
    bot.action(/pause_(\d+)/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        const db = getDb();
        db.prepare('UPDATE managers SET is_paused = 1 WHERE id = ?').run(managerId);
        const manager = getManagerById(managerId);
        ctx.answerCbQuery(`⏸ ${manager.name} на паузе`);

        // Обновляем карточку
        ctx.editMessageText(`⏸ *${manager.name}* поставлен на паузу.\nОн не сможет брать новые заявки.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('▶️ Снять паузу', `unpause_${managerId}`)],
                [Markup.button.callback('◀️ К менеджерам', 'admin_managers')],
            ]),
        });
    });

    // Снять паузу
    bot.action(/unpause_(\d+)/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        const db = getDb();
        db.prepare('UPDATE managers SET is_paused = 0 WHERE id = ?').run(managerId);
        const manager = getManagerById(managerId);
        ctx.answerCbQuery(`▶️ ${manager.name} снова активен`);

        ctx.editMessageText(`✅ *${manager.name}* снова активен!\nМожет брать заявки.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('◀️ К менеджерам', 'admin_managers')],
            ]),
        });
    });

    // Заблокировать
    bot.action(/^block_(\d+)$/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        blockManager(managerId, 'Ручная блокировка администратором', 365);
        const manager = getManagerById(managerId);
        ctx.answerCbQuery(`🚫 ${manager.name} заблокирован`);

        ctx.editMessageText(`🚫 *${manager.name}* заблокирован.\nОн не сможет брать заявки.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Разблокировать', `unblock_${managerId}`)],
                [Markup.button.callback('◀️ К менеджерам', 'admin_managers')],
            ]),
        });
    });

    // Разблокировать
    bot.action(/^unblock_(\d+)$/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        unblockManager(managerId);
        const manager = getManagerById(managerId);
        ctx.answerCbQuery(`✅ ${manager.name} разблокирован`);

        ctx.editMessageText(`✅ *${manager.name}* разблокирован!\nМожет брать заявки.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('◀️ К менеджерам', 'admin_managers')],
            ]),
        });
    });

    // Подтверждение удаления
    bot.action(/^delete_confirm_(\d+)$/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        const manager = getManagerById(managerId);

        ctx.editMessageText(`⚠️ Вы уверены, что хотите удалить *${manager.name}*?\n\nЭто действие нельзя отменить.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🗑 Да, удалить', `delete_${managerId}`)],
                [Markup.button.callback('◀️ Отмена', `mgr_${managerId}`)],
            ]),
        });
    });

    // Удалить менеджера
    bot.action(/^delete_(\d+)$/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        const manager = getManagerById(managerId);
        const db = getDb();
        db.prepare('DELETE FROM managers WHERE id = ?').run(managerId);

        ctx.editMessageText(`🗑 Менеджер *${manager.name}* удалён.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('◀️ К менеджерам', 'admin_managers')],
            ]),
        });
    });

    // Привязка Bitrix ID
    bot.action(/setbitrix_(\d+)/, (ctx) => {
        const managerId = parseInt(ctx.match[1]);
        const manager = getManagerById(managerId);

        ctx.editMessageText(
            `🔗 *Привязка Bitrix ID для ${manager.name}*\n\nТекущий ID: ${manager.bitrix_user_id || 'не задан'}\n\nОтправьте число — Bitrix ID сотрудника.\nЕго можно найти: Bitrix24 → Сотрудники → откройте профиль → число в адресной строке (user/ЧИСЛО/)\n\nНапример: \`15\``,
            { parse_mode: 'Markdown' }
        );
        // Сохраняем в память, для какого менеджера ждём ввод
        pendingBitrixId.set(ctx.from.id, managerId);
    });

    // Добавить менеджера — запрос username
    bot.action('admin_add', (ctx) => {
        ctx.editMessageText(
            '➕ *Добавить менеджера*\n\nОтправьте мне сообщение в формате:\n`@username Имя`\n\nНапример: `@Ivan_ilma Иван`',
            { parse_mode: 'Markdown' }
        );
        // Устанавливаем флаг ожидания ввода
        ctx.session = ctx.session || {};
        ctx.session.waitingForManager = true;
    });

    // Обработка текстового ввода (новый менеджер или Bitrix ID)
    bot.on('text', (ctx, next) => {
        if (ctx.chat.type !== 'private') return next();
        if (!isAdmin(ctx)) return next();

        const text = ctx.message.text.trim();

        // Проверяем, ждём ли Bitrix ID
        if (pendingBitrixId.has(ctx.from.id) && /^\d+$/.test(text)) {
            const managerId = pendingBitrixId.get(ctx.from.id);
            const bitrixId = parseInt(text);
            const db = getDb();
            db.prepare('UPDATE managers SET bitrix_user_id = ? WHERE id = ?').run(bitrixId, managerId);
            const manager = getManagerById(managerId);
            pendingBitrixId.delete(ctx.from.id);

            return ctx.reply(`✅ *${manager.name}* привязан к Bitrix24 (ID: ${bitrixId})`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('◀️ К менеджерам', 'admin_managers')],
                ]),
            });
        }
        const match = text.match(/^@(\S+)\s+(.+)$/);
        if (!match) return next();

        const username = `@${match[1]}`;
        const name = match[2].trim();

        const db = getDb();

        // Проверяем, нет ли уже такого
        const existing = db.prepare('SELECT id FROM managers WHERE telegram_username = ?').get(username);
        if (existing) {
            return ctx.reply(`⚠️ Менеджер ${username} уже существует.`);
        }

        db.prepare('INSERT INTO managers (name, telegram_username) VALUES (?, ?)').run(name, username);

        ctx.reply(`✅ Менеджер *${name}* (${username}) добавлен!\n\nТеперь он должен написать /start боту в личку.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('👥 К менеджерам', 'admin_managers')],
            ]),
        });
    });

    // Управление под-админами (только для суперадмина)
    bot.action('admin_subadmins', (ctx) => {
        if (!isSuperAdmin(ctx)) return ctx.answerCbQuery('🚫 Только для директора');

        const list = subAdminIds.size > 0
            ? `Текущие под-админы: ${subAdminIds.size} чел.`
            : 'Под-админов пока нет.';

        ctx.editMessageText(`🔑 *Управление под-админами*\n\n${list}\n\nОтправьте мне сообщение:\n\`+админ @username\` — добавить\n\`-админ @username\` — удалить`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('◀️ Назад', 'admin_back')],
            ]),
        });
    });

    // Обработка добавления/удаления под-админов
    bot.hears(/^([+-])админ\s+@(\S+)$/i, (ctx) => {
        if (ctx.chat.type !== 'private' || !isSuperAdmin(ctx)) return;

        const action = ctx.match[1];
        const username = `@${ctx.match[2]}`;

        // Ищем пользователя — сначала среди менеджеров, потом среди всех пользователей
        const managers = getAllManagers();
        const foundManager = managers.find(m => m.telegram_username?.toLowerCase() === username.toLowerCase());

        // Ищем среди всех пользователей бота (для не-менеджеров)
        let foundUserId = null;
        let foundName = username;
        if (foundManager && foundManager.telegram_id) {
            foundUserId = foundManager.telegram_id;
            foundName = foundManager.name;
        } else {
            for (const [tgId, user] of botUsers) {
                if (user.username && user.username.toLowerCase() === username.toLowerCase()) {
                    foundUserId = tgId;
                    foundName = user.firstName;
                    break;
                }
            }
        }

        if (action === '+') {
            if (foundUserId) {
                subAdminIds.add(foundUserId);
                ctx.reply(`✅ ${foundName} (${username}) теперь под-админ!`);
            } else {
                ctx.reply(`⚠️ ${username} не найден. Сначала он(а) должна написать /start боту в личку.`);
            }
        } else {
            if (foundUserId) {
                subAdminIds.delete(foundUserId);
                ctx.reply(`✅ ${foundName} (${username}) больше не под-админ.`);
            } else {
                ctx.reply(`⚠️ ${username} не найден.`);
            }
        }
    });

    // Назад в главное меню
    bot.action('admin_back', (ctx) => {
        const buttons = [
            [Markup.button.callback('👥 Менеджеры', 'admin_managers')],
            [Markup.button.callback('📊 Статистика', 'admin_stats')],
            [Markup.button.callback('➕ Добавить менеджера', 'admin_add')],
        ];
        if (isSuperAdmin(ctx)) {
            buttons.push([Markup.button.callback('🔑 Под-админы', 'admin_subadmins')]);
        }

        ctx.editMessageText('⚙️ *Админ-панель Ilmavent*', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
        });
    });

    // Статистика
    bot.action('admin_stats', (ctx) => {
        const db = getDb();
        const total = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status IN ('new','taken')").get();
        const newLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").get();
        const taken = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'taken'").get();
        const managers = getAllManagers();
        const active = managers.filter(m => !m.is_blocked && !m.is_paused).length;

        const text = [
            '📊 *Статистика*',
            '',
            `📩 Активных заявок: ${total.c}`,
            `🆕 Ожидают: ${newLeads.c}`,
            `📋 В работе: ${taken.c}`,
            '',
            `👥 Менеджеров: ${managers.length}`,
            `✅ Активных: ${active}`,
            `⏸ На паузе: ${managers.filter(m => m.is_paused).length}`,
            `🚫 Заблокированных: ${managers.filter(m => m.is_blocked).length}`,
        ].join('\n');

        ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📋 Отчёт за неделю', 'report_week')],
                [Markup.button.callback('📋 Отчёт за месяц', 'report_month')],
                [Markup.button.callback('◀️ Назад', 'admin_back')],
            ]),
        });
    });

    // Генерация отчётов по кнопке
    bot.action('report_week', async (ctx) => {
        const { generateReport, sendReport } = require('../reports/reports');
        const report = generateReport('Неделя', 7);
        await sendReport(report);
        ctx.answerCbQuery('📊 Отчёт отправлен в группу!');
    });

    bot.action('report_month', async (ctx) => {
        const { generateReport, sendReport } = require('../reports/reports');
        const report = generateReport('Месяц', 30);
        await sendReport(report);
        ctx.answerCbQuery('📊 Отчёт отправлен в группу!');
    });

    console.log('⚙️ Админ-панель подключена');
}

module.exports = { registerAdminCommands, isAdmin, isSuperAdmin, trackBotUser };
