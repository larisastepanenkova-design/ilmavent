const config = require('./config');
const { initDatabase, seedManagers } = require('./db/database');

console.log('🚀 Запуск Ilmavent...');

// 1. Инициализация базы данных
initDatabase();
seedManagers();

// 2. Запуск Express-сервера
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статика для дашборда
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API для дашборда ---
const { getActiveLeads } = require('./db/leads');
const { getAllManagers } = require('./db/managers');

app.get('/api/leads', (req, res) => {
    const leads = getActiveLeads();
    res.json(leads);
});

app.get('/api/managers', (req, res) => {
    const managers = getAllManagers();
    res.json(managers);
});

// --- Вебхуки для приёма заявок ---
const { autoDetectAndParse } = require('./leads/collector');
const { createLead, findByPhone, markDuplicate, getLeadById } = require('./db/leads');
const { isNightMode } = require('./managers/restrictions');
const { startBot, publishLead, publishNightLeads } = require('./bot/telegram');

// Универсальный вебхук (принимает любой тип формы)
app.post('/webhook/lead', async (req, res) => {
    try {
        console.log('📩 Новая заявка:', JSON.stringify(req.body).substring(0, 200));

        // Парсим заявку
        const parsed = autoDetectAndParse(req.body);

        // Проверка на дубль по телефону
        if (parsed.client_phone) {
            const existing = findByPhone(parsed.client_phone);
            if (existing) {
                console.log(`⚠️ Дубль: ${parsed.client_phone} → менеджер ${existing.manager_name}`);
                const leadId = createLead(parsed);
                markDuplicate(leadId, existing.manager_name);

                // TODO: отправить в Telegram «Дубль. Ответственный: ...»
                return res.json({ status: 'duplicate', manager: existing.manager_name });
            }
        }

        // Создаём заявку в БД
        const leadId = createLead(parsed);
        console.log(`✅ Заявка #${leadId} создана (${parsed.source})`);

        // Публикуем в Telegram
        const lead = getLeadById(leadId);
        publishLead(lead).catch(err => console.error('❌ Telegram:', err.message));

        res.json({ status: 'ok', leadId });
    } catch (error) {
        console.error('❌ Ошибка приёма заявки:', error);
        res.status(500).json({ error: error.message });
    }
});

// Отдельные эндпоинты (алиасы для разных форм)
app.post('/webhook/site', (req, res) => {
    req.body._source = 'site';
    app.handle(req, res);
});

app.post('/webhook/quiz1', (req, res) => {
    req.body._source = 'quiz1';
    app.handle(req, res);
});

app.post('/webhook/quiz2', (req, res) => {
    req.body._source = 'quiz2';
    app.handle(req, res);
});

// --- Таймеры ---
const cron = require('node-cron');
const { checkColors } = require('./timers/color-checker');

// Проверка цветов каждые 30 секунд
setInterval(() => {
    checkColors();
}, config.dashboard.refreshInterval);

console.log('⏱️ Таймеры запущены (проверка цветов каждые 30 сек)');

// Утренняя рассылка ночных заявок в 06:00
cron.schedule('0 6 * * *', () => {
    console.log('☀️ 06:00 — запуск утренней рассылки ночных заявок');
    publishNightLeads().catch(err => console.error('❌ Утренняя рассылка:', err.message));
});
console.log('☀️ Утренняя рассылка ночных заявок: ежедневно в 06:00');

// --- Telegram-бот ---
const botInstance = startBot();

// --- Отчёты ---
const { startReportSchedule, setBotInstance } = require('./reports/reports');
if (botInstance) {
    setBotInstance(botInstance);
}
startReportSchedule();

// --- Запуск сервера ---
app.listen(config.server.port, () => {
    console.log(`🌐 Сервер: http://localhost:${config.server.port}`);
    console.log(`📊 Дашборд: http://localhost:${config.server.port}/`);
    console.log(`📩 Вебхук: http://localhost:${config.server.port}/webhook/lead`);
    console.log('');
    console.log('✅ Система готова!');
});
