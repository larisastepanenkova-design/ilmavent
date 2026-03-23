const { getTakenLeadsWithBitrix, markContacted } = require('../db/leads');
const { checkActivityCompleted } = require('../bitrix/tasks');

/**
 * Проверяет в Битриксе, выполнены ли CRM-активности по взятым заявкам.
 * Если активность закрыта (менеджер отметил звонок) → обновляем статус на 'contacted',
 * заявка уходит с дашборда.
 */
async function checkBitrixActivities() {
    const leads = getTakenLeadsWithBitrix();

    if (leads.length === 0) return;

    for (const lead of leads) {
        const completed = await checkActivityCompleted(lead.bitrix_task_id);

        if (completed) {
            markContacted(lead.id);
            console.log(`✅ Заявка #${lead.id}: активность выполнена в Битриксе → статус 'contacted'`);
        }
    }
}

module.exports = { checkBitrixActivities };
