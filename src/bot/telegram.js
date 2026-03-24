const { Telegraf, Markup } = require('telegraf');
const config = require('../config');
const { getManagerByTelegramId, setTelegramId, getAllManagers } = require('../db/managers');
const { getLeadById, takeLead, updateTelegramMessageId, markDuplicate } = require('../db/leads');
const { canTakeLead, isNightMode, handleRedZone } = require('../managers/restrictions');
const { createContact, findContactByPhone } = require('../bitrix/contacts');
const { createDeal } = require('../bitrix/deals');
const { createContactActivity } = require('../bitrix/tasks');
const { updateBitrixIds } = require('../db/leads');
const { logEvent } = require('../db/history');

let bot;

/**
 * Запустить Telegram-бота
 */
function startBot() {
    if (!config.telegram.botToken) {
        console.log('⚠️ Telegram бот: токен не задан, пропускаю запуск');
        return null;
    }

    bot = new Telegraf(config.telegram.botToken);

    // Автоопределение группы: логируем все чаты
    bot.use((ctx, next) => {
        const chat = ctx.chat;
        if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
            if (!config.telegram.channelId) {
                console.log(`📌 Найдена группа: "${chat.title}" → ID: ${chat.id}`);
                console.log(`📌 Впишите этот ID в .env → TELEGRAM_CHANNEL_ID=${chat.id}`);

                // Автоматически сохраняем
                config.telegram.channelId = String(chat.id);

                // Обновляем .env файл
                const fs = require('fs');
                const path = require('path');
                const envPath = path.join(__dirname, '..', '..', '.env');
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace('TELEGRAM_CHANNEL_ID=', `TELEGRAM_CHANNEL_ID=${chat.id}`);
                fs.writeFileSync(envPath, envContent);
                console.log('✅ ID группы автоматически сохранён в .env');
            }
        }
        return next();
    });

    // /start — приветствие и привязка аккаунта
    bot.start((ctx) => {
        const username = ctx.from.username ? `@${ctx.from.username}` : null;
        const telegramId = ctx.from.id;

        // В группе — просто подтверждаем
        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
            ctx.reply('✅ Бот подключён к этой группе! Заявки будут приходить сюда.');
            return;
        }

        // Запоминаем пользователя (для поиска под-админов)
        const { trackBotUser } = require('./admin');
        trackBotUser(ctx);

        // Ищем менеджера по username
        if (username) {
            const managers = getAllManagers();
            const manager = managers.find(
                (m) => m.telegram_username && m.telegram_username.toLowerCase() === username.toLowerCase()
            );

            if (manager && !manager.telegram_id) {
                setTelegramId(manager.id, telegramId);
                ctx.reply(`✅ Привет, ${manager.name}! Ваш аккаунт привязан. Вы будете получать заявки и уведомления.`);
                console.log(`🔗 Привязан менеджер: ${manager.name} → Telegram ID ${telegramId}`);
                return;
            } else if (manager) {
                ctx.reply(`Привет, ${manager.name}! Вы уже привязаны. Ожидайте заявок.`);
                return;
            }
        }

        ctx.reply('👋 Привет! Я бот Ilmavent для распределения заявок.\n\nЕсли вы менеджер — ваш аккаунт будет привязан автоматически.');
    });

    // Обработка нажатия «Взять заявку»
    bot.action(/take_lead_(\d+)/, async (ctx) => {
        const leadId = parseInt(ctx.match[1]);
        const telegramId = ctx.from.id;

        const manager = getManagerByTelegramId(telegramId);
        if (!manager) {
            return ctx.answerCbQuery('❌ Вы не зарегистрированы. Нажмите /start');
        }

        // Проверяем ограничения
        const check = canTakeLead(manager.id);
        if (!check.allowed) {
            return ctx.answerCbQuery(check.reason, { show_alert: true });
        }

        // Пробуем взять заявку
        const lead = getLeadById(leadId);
        if (!lead) {
            return ctx.answerCbQuery('❌ Заявка не найдена');
        }

        if (lead.status !== 'new') {
            return ctx.answerCbQuery(`⚠️ Заявка уже взята: ${lead.manager_name || 'кем-то'}`);
        }

        const taken = takeLead(leadId, manager.id);
        if (!taken) {
            return ctx.answerCbQuery('⚠️ Не удалось взять заявку — попробуйте ещё раз');
        }

        console.log(`✅ ${manager.name} взял заявку #${leadId}`);

        // Обновляем сообщение — убираем кнопку
        try {
            await ctx.editMessageReplyMarkup(undefined);
            await ctx.editMessageText(
                ctx.callbackQuery.message.text + `\n\n✅ Взял: ${manager.name}`,
                { parse_mode: 'HTML' }
            );
        } catch (e) {
            // Если не удалось отредактировать — не критично
        }

        ctx.answerCbQuery(`✅ Заявка #${leadId} ваша!`);

        // Интеграция с Bitrix24 (асинхронно)
        processBitrixIntegration(lead, manager).catch((err) => {
            console.error(`❌ Ошибка Bitrix24 для заявки #${leadId}:`, err.message);
        });
    });

    // Подключаем админ-панель
    const { registerAdminCommands } = require('./admin');
    registerAdminCommands(bot);

    bot.launch();
    console.log('🤖 Telegram-бот запущен');

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

/**
 * Отправить новую заявку в канал/группу с кнопкой «Взять»
 */
async function publishLead(lead) {
    if (!bot || !config.telegram.channelId) return;

    // Ночной режим — не отправляем
    if (isNightMode()) {
        console.log(`🌙 Ночной режим: заявка #${lead.id} будет отправлена утром`);
        return;
    }

    const sourceLabels = {
        site: '🌐 Сайт', quiz1: '📝 Квиз1', quiz2: '📝 Квиз2',
        popup: '🌐 Сайт', calculator: '🔢 Калькулятор',
        whatsapp: '📱 WhatsApp', email: '📧 Почта', telegram: '✈️ Telegram',
    };

    const source = sourceLabels[lead.source] || lead.source;
    const text = [
        `📩 <b>Новая заявка #${lead.id}</b>`,
        ``,
        `${source}`,
        lead.client_name ? `👤 ${lead.client_name}` : '',
        lead.client_phone ? `📞 ${lead.client_phone}` : '',
        lead.client_email ? `📧 ${lead.client_email}` : '',
    ].filter(Boolean).join('\n');

    try {
        const msg = await bot.telegram.sendMessage(
            config.telegram.channelId,
            text,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('📋 Взять заявку', `take_lead_${lead.id}`),
                ]),
            }
        );

        updateTelegramMessageId(lead.id, msg.message_id);
    } catch (err) {
        console.error(`❌ Ошибка отправки в Telegram:`, err.message);
    }
}

/**
 * Отправить уведомление менеджеру
 */
async function notifyManager(managerId, text) {
    if (!bot) return;

    const { getManagerById } = require('../db/managers');
    const manager = getManagerById(managerId);
    if (!manager || !manager.telegram_id) return;

    try {
        await bot.telegram.sendMessage(manager.telegram_id, text, { parse_mode: 'HTML' });
    } catch (err) {
        console.error(`❌ Ошибка уведомления менеджеру ${manager.name}:`, err.message);
    }
}

/**
 * Асинхронная интеграция с Bitrix24 после взятия заявки
 */
async function processBitrixIntegration(lead, manager) {
    if (!config.bitrix.webhookUrl) return;

    // Проверяем наличие bitrix_user_id — без него сделка уйдёт на администратора
    const bitrixUserId = manager.bitrix_user_id;
    if (!bitrixUserId) {
        console.error(`⚠️ У менеджера ${manager.name} (ID=${manager.id}) не задан bitrix_user_id! Сделка будет назначена на администратора.`);
        await notifyManager(manager.id,
            `⚠️ <b>Внимание!</b>\nВаш аккаунт не привязан к Битрикс24.\nСделка будет назначена на администратора. Обратитесь к руководителю.`
        );
    }
    const assigneeId = bitrixUserId || 1;

    // 1. Проверяем дубли в Bitrix24
    if (lead.client_phone) {
        const duplicate = await findContactByPhone(lead.client_phone);
        if (duplicate.found) {
            console.log(`⚠️ Дубль в Bitrix24: ${lead.client_phone} → ${duplicate.managerName}`);
            await notifyManager(manager.id,
                `⚠️ <b>Дубль!</b>\nКлиент ${lead.client_phone} уже есть в Bitrix24.\nОтветственный: ${duplicate.managerName}`
            );
            return;
        }
    }

    // 2. Создаём контакт
    const contactId = await createContact({
        name: lead.client_name,
        phone: lead.client_phone,
        email: lead.client_email,
        managerId: assigneeId,
    });

    // 3. Формируем комментарий из данных заявки
    const { FIELD_LABELS } = require('../bitrix/tasks');
    const sourceNames = {
        site: 'Сайт', quiz1: 'Квиз1', quiz2: 'Квиз2',
        popup: 'Сайт', calculator: 'Калькулятор',
    };
    let comment = '';
    if (lead.form_data) {
        try {
            const data = typeof lead.form_data === 'string' ? JSON.parse(lead.form_data) : lead.form_data;
            const lines = [];
            for (const [key, value] of Object.entries(data)) {
                if (value && !['ip_address', 'tranid', 'Checkbox'].includes(key)) {
                    const label = FIELD_LABELS[key] || key.replace(/_/g, ' ');
                    lines.push(`${label}: ${value}`);
                }
            }
            if (lines.length > 0) {
                comment = `Данные заявки:\n${lines.join('\n')}`;
            }
        } catch (e) { }
    }
    comment += `\n\nИсточник: ${sourceNames[lead.source] || lead.source}`;

    // 4. Создаём сделку
    const dealId = await createDeal({
        contactId,
        title: `Заявка #${lead.id} — ${lead.client_name || lead.client_phone}`,
        source: lead.source,
        managerId: assigneeId,
        comment,
    });

    // 5. Добавляем закрепляемый комментарий с данными заявки
    try {
        let commentText = `📋 Заявка #${lead.id}\n`;
        commentText += `Источник: ${sourceNames[lead.source] || lead.source}\n`;
        commentText += `Имя: ${lead.client_name || '—'}\n`;
        commentText += `Телефон: ${lead.client_phone || '—'}\n`;
        if (lead.client_email) commentText += `Email: ${lead.client_email}\n`;

        if (lead.form_data) {
            try {
                const data = typeof lead.form_data === 'string' ? JSON.parse(lead.form_data) : lead.form_data;
                commentText += '\n--- Данные заявки ---\n';
                for (const [key, value] of Object.entries(data)) {
                    if (value && !['ip_address', 'tranid', 'Checkbox'].includes(key)) {
                        commentText += `${FIELD_LABELS[key] || key}: ${value}\n`;
                    }
                }
            } catch (e) { }
        }

        if (lead.utm_source) commentText += `\nUTM source: ${lead.utm_source}`;
        if (lead.utm_campaign) commentText += `\nUTM campaign: ${lead.utm_campaign}`;

        const { callBitrix } = require('../bitrix/api');
        await callBitrix('crm.timeline.comment.add', {
            fields: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: 'deal',
                COMMENT: commentText,
            }
        });
        console.log(`✅ Комментарий добавлен к сделке #${dealId}`);
    } catch (e) {
        console.log(`⚠️ Не удалось добавить комментарий: ${e.message}`);
    }

    // 6. Создаём дело «Установить контакт»
    const activityId = await createContactActivity({
        dealId,
        contactId,
        contactName: lead.client_name,
        phone: lead.client_phone,
        managerId: assigneeId,
        leadData: {
            source: lead.source,
            formData: lead.form_data,
        },
    });

    // 7. Сохраняем ID в нашу БД
    updateBitrixIds(lead.id, { contactId, dealId, taskId: activityId });

    console.log(`✅ Bitrix24: контакт #${contactId}, сделка #${dealId}, дело #${activityId}`);
}

/**
 * Утренняя рассылка: отправить все ночные заявки в Telegram
 */
async function publishNightLeads() {
    if (!bot || !config.telegram.channelId) return;

    const { getNightLeads } = require('../db/leads');
    const nightLeads = getNightLeads();

    if (nightLeads.length === 0) {
        console.log('☀️ Утренняя рассылка: ночных заявок нет');
        return;
    }

    console.log(`☀️ Утренняя рассылка: ${nightLeads.length} ночных заявок`);

    for (const lead of nightLeads) {
        await publishLead(lead);
        // Пауза 500мс между сообщениями чтобы не словить лимит Telegram
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Отправлено ${nightLeads.length} ночных заявок`);
}

module.exports = { startBot, publishLead, notifyManager, publishNightLeads };
