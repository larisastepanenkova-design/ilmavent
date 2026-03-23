const { getDb } = require('./database');

/**
 * Создать новую заявку
 */
function createLead(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO leads (source, client_name, client_phone, client_email, form_data, utm_source, utm_campaign)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.source,
    data.client_name || null,
    data.client_phone || null,
    data.client_email || null,
    data.form_data ? JSON.stringify(data.form_data) : null,
    data.utm_source || null,
    data.utm_campaign || null
  );

  return result.lastInsertRowid;
}

/**
 * Взять заявку менеджером
 */
function takeLead(leadId, managerId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE leads
    SET taken_by = ?, taken_at = datetime('now', 'localtime'), status = 'taken'
    WHERE id = ? AND status = 'new'
  `);

  const result = stmt.run(managerId, leadId);
  return result.changes > 0;
}

/**
 * Обновить цвет заявки
 */
function updateLeadColor(leadId, color) {
  const db = getDb();
  db.prepare('UPDATE leads SET color = ? WHERE id = ?').run(color, leadId);
}

/**
 * Пометить заявку как обработанную
 */
function markContacted(leadId) {
  const db = getDb();
  db.prepare("UPDATE leads SET status = 'contacted' WHERE id = ?").run(leadId);
}

/**
 * Сохранить ID из Bitrix24
 */
function updateBitrixIds(leadId, { contactId, dealId, taskId }) {
  const db = getDb();
  db.prepare(`
    UPDATE leads
    SET bitrix_contact_id = ?, bitrix_deal_id = ?, bitrix_task_id = ?
    WHERE id = ?
  `).run(contactId || null, dealId || null, taskId || null, leadId);
}

/**
 * Сохранить Telegram message ID
 */
function updateTelegramMessageId(leadId, messageId) {
  const db = getDb();
  db.prepare('UPDATE leads SET telegram_message_id = ? WHERE id = ?').run(messageId, leadId);
}

/**
 * Пометить как дубль
 */
function markDuplicate(leadId, managerName) {
  const db = getDb();
  db.prepare(`
    UPDATE leads SET is_duplicate = 1, duplicate_manager = ?, status = 'duplicate'
    WHERE id = ?
  `).run(managerName, leadId);
}

/**
 * Найти заявку по номеру телефона (для проверки дублей)
 */
function findByPhone(phone) {
  const db = getDb();
  // Нормализуем: убираем всё кроме цифр
  const digits = phone.replace(/\D/g, '');
  // Ищем по последним 10 цифрам (без кода страны)
  const last10 = digits.slice(-10);

  return db.prepare(`
    SELECT l.*, m.name as manager_name
    FROM leads l
    LEFT JOIN managers m ON l.taken_by = m.id
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.client_phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')
    LIKE '%' || ?
    AND l.status NOT IN ('duplicate')
    ORDER BY l.created_at DESC
    LIMIT 1
  `).get(last10);
}

/**
 * Получить активные заявки (для дашборда)
 */
function getActiveLeads() {
  const db = getDb();
  return db.prepare(`
    SELECT l.*, m.name as manager_name
    FROM leads l
    LEFT JOIN managers m ON l.taken_by = m.id
    WHERE l.status IN ('new', 'taken')
    AND l.is_duplicate = 0
    ORDER BY l.created_at DESC
  `).all();
}

/**
 * Получить заявку по ID
 */
function getLeadById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT l.*, m.name as manager_name
    FROM leads l
    LEFT JOIN managers m ON l.taken_by = m.id
    WHERE l.id = ?
  `).get(id);
}

/**
 * Статистика за период (для отчётов)
 */
function getLeadStats(fromDate, toDate) {
  const db = getDb();

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM leads
    WHERE created_at >= ? AND created_at <= ? AND is_duplicate = 0
  `).get(fromDate, toDate);

  const byManager = db.prepare(`
    SELECT m.name, COUNT(*) as count
    FROM leads l
    JOIN managers m ON l.taken_by = m.id
    WHERE l.created_at >= ? AND l.created_at <= ? AND l.is_duplicate = 0
    GROUP BY l.taken_by
  `).all(fromDate, toDate);

  const bySource = db.prepare(`
    SELECT source, COUNT(*) as count
    FROM leads
    WHERE created_at >= ? AND created_at <= ? AND is_duplicate = 0
    GROUP BY source
  `).all(fromDate, toDate);

  return { total: total.count, byManager, bySource };
}

/**
 * Получить "ночные" заявки — новые, не отправленные в Telegram
 */
function getNightLeads() {
  const db = getDb();
  return db.prepare(`
    SELECT l.*, m.name as manager_name
    FROM leads l
    LEFT JOIN managers m ON l.taken_by = m.id
    WHERE l.status = 'new'
    AND l.telegram_message_id IS NULL
    AND l.is_duplicate = 0
    ORDER BY l.created_at ASC
  `).all();
}

/**
 * Получить взятые заявки с привязкой к Битриксу (для проверки статуса)
 */
function getTakenLeadsWithBitrix() {
  const db = getDb();
  return db.prepare(`
    SELECT id, bitrix_task_id
    FROM leads
    WHERE status = 'taken'
    AND bitrix_task_id IS NOT NULL
  `).all();
}

module.exports = {
  createLead,
  takeLead,
  updateLeadColor,
  markContacted,
  updateBitrixIds,
  updateTelegramMessageId,
  markDuplicate,
  findByPhone,
  getActiveLeads,
  getLeadById,
  getLeadStats,
  getNightLeads,
  getTakenLeadsWithBitrix,
};
