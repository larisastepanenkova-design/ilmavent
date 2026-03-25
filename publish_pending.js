/**
 * Разовый скрипт: публикация неотправленных заявок в Telegram-канал.
 * Использует Telegram API напрямую (без polling), чтобы не конфликтовать с PM2.
 * Запуск: node publish_pending.js
 */
require('dotenv').config();
const { Telegram, Markup } = require('telegraf');
const { initDatabase } = require('./src/db/database');
const { updateTelegramMessageId } = require('./src/db/leads');
const { getDb } = require('./src/db/database');

const token = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;

if (!token || !channelId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID in .env');
    process.exit(1);
}

const telegram = new Telegram(token);
initDatabase();

const db = getDb();
const pendingLeads = db.prepare(`
    SELECT l.*, m.name as manager_name
    FROM leads l
    LEFT JOIN managers m ON l.taken_by = m.id
    WHERE l.status = 'new'
    AND l.telegram_message_id IS NULL
    AND l.is_duplicate = 0
    ORDER BY l.created_at ASC
`).all();

if (pendingLeads.length === 0) {
    console.log('No pending leads to publish');
    process.exit(0);
}

console.log(`Found ${pendingLeads.length} pending lead(s)`);

const sourceLabels = {
    site: '\u{1F310} \u0421\u0430\u0439\u0442',
    quiz1: '\u{1F4DD} \u041A\u0432\u0438\u04371',
    quiz2: '\u{1F4DD} \u041A\u0432\u04382',
    popup: '\u{1F310} \u0421\u0430\u0439\u0442',
    calculator: '\u{1F522} \u041A\u0430\u043B\u044C\u043A\u0443\u043B\u044F\u0442\u043E\u0440',
    whatsapp: '\u{1F4F1} WhatsApp',
    email: '\u{1F4E7} \u041F\u043E\u0447\u0442\u0430',
    telegram: '\u2708\uFE0F Telegram',
};

(async () => {
    for (const lead of pendingLeads) {
        const source = sourceLabels[lead.source] || lead.source;
        const text = [
            `\u{1F4E9} <b>\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430 #${lead.id}</b>`,
            ``,
            `${source}`,
            lead.client_name ? `\u{1F464} ${lead.client_name}` : '',
            lead.client_phone ? `\u{1F4DE} ${lead.client_phone}` : '',
            lead.client_email ? `\u{1F4E7} ${lead.client_email}` : '',
        ].filter(Boolean).join('\n');

        try {
            const msg = await telegram.sendMessage(channelId, text, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    Markup.button.callback('\u{1F4CB} \u0412\u0437\u044F\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443', `take_lead_${lead.id}`),
                ]),
            });

            updateTelegramMessageId(lead.id, msg.message_id);
            console.log(`Published lead #${lead.id}, message_id: ${msg.message_id}`);
        } catch (err) {
            console.error(`Error publishing lead #${lead.id}:`, err.message);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Done!');
    process.exit(0);
})();
