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
const { enqueue, getLeadQueueStatus } = require('./queue/lead-queue');
const { getQueueStatus: getBitrixQueueStatus } = require('./bitrix/api');

// Общая логика обработки заявки (используется всеми эндпоинтами)
// Вебхук сохраняет заявку в БД сразу (быстрый ответ Тильде),
// а тяжёлая обработка (Telegram, проверка дублей) идёт через очередь.
async function handleLeadWebhook(req, res) {
    try {
        console.log('📩 Новая заявка:', JSON.stringify(req.body).substring(0, 200));

        // Парсим заявку (autoDetectAndParse учитывает _source если задан)
        const parsed = autoDetectAndParse(req.body);

        // Проверка на дубль по телефону (быстрая, по локальной БД)
        if (parsed.client_phone) {
            const existing = findByPhone(parsed.client_phone);
            if (existing) {
                console.log(`⚠️ Дубль: ${parsed.client_phone} → менеджер ${existing.manager_name}`);
                const leadId = createLead(parsed);
                markDuplicate(leadId, existing.manager_name);
                return res.json({ status: 'duplicate', manager: existing.manager_name });
            }
        }

        // Создаём заявку в БД (мгновенно)
        const leadId = createLead(parsed);
        console.log(`✅ Заявка #${leadId} создана (${parsed.source})`);

        // Публикацию в Telegram ставим в очередь (защита от залпа)
        enqueue(async () => {
            const lead = getLeadById(leadId);
            await publishLead(lead);
        });

        res.json({ status: 'ok', leadId });
    } catch (error) {
        console.error('❌ Ошибка приёма заявки:', error);
        res.status(500).json({ error: error.message });
    }
}

// --- Эндпоинт здоровья системы ---
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        leadQueue: getLeadQueueStatus(),
        bitrixQueue: getBitrixQueueStatus(),
    });
});

// Универсальный вебхук (принимает любой тип формы)
app.post('/webhook/lead', handleLeadWebhook);

// Отдельные эндпоинты для разных форм (задают источник явно)
app.post('/webhook/site', (req, res) => {
    req.body._source = 'site';
    handleLeadWebhook(req, res);
});

app.post('/webhook/quiz1', (req, res) => {
    req.body._source = 'quiz1';
    handleLeadWebhook(req, res);
});

app.post('/webhook/quiz2', (req, res) => {
    req.body._source = 'quiz2';
    handleLeadWebhook(req, res);
});

// --- Таймеры ---
const cron = require('node-cron');
const { checkColors } = require('./timers/color-checker');
const { checkBitrixActivities } = require('./timers/bitrix-checker');

// Проверка цветов каждые 30 секунд
setInterval(() => {
    checkColors();
}, config.dashboard.refreshInterval);

// Проверка статуса активностей в Битриксе каждые 30 сек
setInterval(() => {
    checkBitrixActivities().catch(err =>
        console.error('❌ Проверка Битрикса:', err.message)
    );
}, config.dashboard.refreshInterval);

console.log('⏱️ Таймеры запущены (цвета + проверка Битрикса каждые 30 сек)');

// Утренняя рассылка ночных заявок в 06:00 MSK (= 03:00 UTC)
cron.schedule('0 3 * * *', () => {
    console.log('☀️ 06:00 MSK — запуск утренней рассылки ночных заявок');
    publishNightLeads().catch(err => console.error('❌ Утренняя рассылка:', err.message));
});
console.log('☀️ Утренняя рассылка ночных заявок: ежедневно в 06:00 MSK');

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
