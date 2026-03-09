const { callBitrix } = require('./api');

/**
 * Создать сделку в Bitrix24
 */
// Маппинг наших источников на коды Bitrix24
const SOURCE_MAP = {
    'site': 'UC_RK',
    'popup': 'UC_RK',
    'quiz1': 'UC_RK',
    'quiz2': 'UC_RK',
    'email': 'EMAIL',
    'whatsapp': 'OTHER',
    'telegram': 'OTHER',
};

// Русские названия для поля РК (рекламная кампания)
const SOURCE_NAMES = {
    'site': 'Сайт',
    'popup': 'Сайт',
    'quiz1': 'Квиз1',
    'quiz2': 'Квиз2',
    'email': 'Почта',
    'whatsapp': 'WhatsApp',
    'telegram': 'Telegram',
};

async function createDeal({ contactId, title, source, managerId, comment }) {
    const fields = {
        TITLE: title || 'Новая заявка с сайта',
        CONTACT_ID: contactId,
        ASSIGNED_BY_ID: managerId || 1,
        STAGE_ID: 'NEW',
        SOURCE_ID: SOURCE_MAP[source] || 'WEB',
        SOURCE_DESCRIPTION: SOURCE_NAMES[source] || source || '',
        CATEGORY_ID: 0,
    };

    if (comment) {
        fields.COMMENTS = comment;
    }

    const result = await callBitrix('crm.deal.add', { fields });
    console.log(`✅ Сделка создана в Bitrix24: ID ${result.result}`);
    return result.result;
}

/**
 * Получить этапы воронки
 */
async function getDealStages() {
    const result = await callBitrix('crm.dealcategory.stage.list', { id: 0 });
    return result.result;
}

/**
 * Получить статистику по воронке (для отчётов)
 */
async function getDealStats() {
    const stages = await getDealStages();
    const stats = [];

    for (const stage of stages) {
        const result = await callBitrix('crm.deal.list', {
            filter: { STAGE_ID: stage.STATUS_ID, CATEGORY_ID: 0 },
            select: ['ID'],
        });
        stats.push({
            stageId: stage.STATUS_ID,
            stageName: stage.NAME,
            count: result.total || 0,
        });
    }

    return stats;
}

module.exports = { createDeal, getDealStages, getDealStats };
