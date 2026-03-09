const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'ilmavent.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

/**
 * Создание всех таблиц
 */
function initDatabase() {
    const db = getDb();

    db.exec(`
    -- Заявки
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,               -- site / quiz1 / quiz2 / whatsapp / email / telegram / popup
      client_name TEXT,
      client_phone TEXT,
      client_email TEXT,
      form_data TEXT,                      -- JSON с доп. полями (площадь, этажи и т.д.)
      utm_source TEXT,
      utm_campaign TEXT,
      telegram_message_id INTEGER,        -- ID сообщения в Telegram-канале
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      taken_at TEXT,
      taken_by INTEGER REFERENCES managers(id),
      status TEXT DEFAULT 'new',          -- new / taken / contacted / expired
      color TEXT DEFAULT 'green',         -- green / yellow / red
      bitrix_contact_id INTEGER,
      bitrix_deal_id INTEGER,
      bitrix_task_id INTEGER,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_manager TEXT
    );

    -- Менеджеры
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      telegram_username TEXT,
      telegram_id INTEGER,                -- числовой ID в Telegram (узнаем позже)
      bitrix_user_id INTEGER,
      is_blocked INTEGER DEFAULT 0,
      blocked_until TEXT,
      blocked_reason TEXT,
      red_zone_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- История (красные зоны, блокировки)
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER REFERENCES managers(id),
      event_type TEXT NOT NULL,           -- red_zone / block / unblock / manual_block
      lead_id INTEGER REFERENCES leads(id),
      details TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Индексы
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_color ON leads(color);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(client_phone);
    CREATE INDEX IF NOT EXISTS idx_leads_taken_by ON leads(taken_by);
    CREATE INDEX IF NOT EXISTS idx_history_manager ON history(manager_id);
  `);

    console.log('✅ База данных инициализирована');
}

/**
 * Добавить начальных менеджеров
 */
function seedManagers() {
    const db = getDb();

    const managers = [
        { name: 'Арсений', telegram_username: '@Ap_ilma' },
        { name: 'Антон', telegram_username: '@AntonIlma' },
        { name: 'Денис', telegram_username: '@Denis_ilma' },
        { name: 'Дмитрий', telegram_username: '@Sokolov_Ilma' },
        { name: 'Александр', telegram_username: '@Ilma_aleksandr' },
    ];

    const existing = db.prepare('SELECT COUNT(*) as count FROM managers').get();

    if (existing.count === 0) {
        const insert = db.prepare(
            'INSERT INTO managers (name, telegram_username) VALUES (?, ?)'
        );

        for (const m of managers) {
            insert.run(m.name, m.telegram_username);
        }

        console.log(`✅ Добавлено ${managers.length} менеджеров`);
    } else {
        console.log(`ℹ️ Менеджеры уже в базе (${existing.count} чел.)`);
    }
}

module.exports = { getDb, initDatabase, seedManagers };
