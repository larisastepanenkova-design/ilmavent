const config = require('../config');
const { getDb } = require('../db/database');
const { updateLeadColor } = require('../db/leads');
const { handleRedZone } = require('../managers/restrictions');

/**
 * Проверить все активные заявки и обновить цвета
 * Вызывается каждые 30 секунд
 */
function checkColors() {
    const db = getDb();

    // Получаем заявки в статусе 'taken' (взяты, но не обработаны)
    const leads = db.prepare(`
    SELECT id, taken_at, taken_by, color FROM leads
    WHERE status = 'taken' AND color != 'contacted'
  `).all();

    const now = new Date();

    for (const lead of leads) {
        const takenAt = new Date(lead.taken_at);
        const diffMin = (now - takenAt) / 60000;

        let newColor;
        if (diffMin >= config.thresholds.red) {
            newColor = 'red';
        } else if (diffMin >= config.thresholds.yellow) {
            newColor = 'yellow';
        } else {
            newColor = 'green';
        }

        // Если цвет изменился
        if (newColor !== lead.color) {
            updateLeadColor(lead.id, newColor);

            // При переходе в красную зону — обрабатываем
            if (newColor === 'red' && lead.color !== 'red') {
                handleRedZone(lead.taken_by, lead.id);
                console.log(`🔴 Заявка #${lead.id} перешла в красную зону`);
            }

            if (newColor === 'yellow' && lead.color === 'green') {
                console.log(`🟡 Заявка #${lead.id} перешла в жёлтую зону`);
            }
        }
    }
}

module.exports = { checkColors };
