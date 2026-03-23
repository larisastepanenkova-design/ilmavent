const { callBitrix } = require('./api');

// Маппинг английских ключей на русские названия
const FIELD_LABELS = {
    object: 'Объект',
    area: 'Площадь',
    systems: 'Системы',
    room_type: 'Тип помещения',
    concern: 'Что беспокоит',
    priority: 'Что важно',
    timeline: 'Когда планируете',
    type: 'Тип объекта',
    kitchen: 'Кухня',
    livingroom: 'Гостиная',
    ceiling: 'Потолок',
    floors: 'Этажей',
    bathrooms: 'Санузлов',
    bedrooms: 'Спален',
};

// Человекочитаемые названия источников
const SOURCE_NAMES = {
    site: 'Сайт',
    popup: 'Сайт',
    quiz1: 'Квиз1',
    quiz2: 'Квиз2',
    email: 'Почта',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
};

/**
 * Создать дело «Установить контакт с клиентом» (CRM Activity)
 * Условия как у задачи: дедлайн 2 часа, высокий приоритет, привязка к сделке
 */
async function createContactActivity({ dealId, contactId, contactName, phone, managerId, leadData }) {
    // Формируем описание с данными заявки
    let description = `Новая заявка. Свяжитесь с клиентом.\n\nТелефон: ${phone || '—'}\nИмя: ${contactName || '—'}`;

    if (leadData) {
        if (leadData.source) {
            const sourceName = SOURCE_NAMES[leadData.source] || leadData.source;
            description += `\n\nИсточник: ${sourceName}`;
        }
        if (leadData.formData) {
            try {
                const data = typeof leadData.formData === 'string' ? JSON.parse(leadData.formData) : leadData.formData;
                const lines = [];
                for (const [key, value] of Object.entries(data)) {
                    if (value && !['ip_address', 'tranid', 'Checkbox'].includes(key)) {
                        lines.push(`${FIELD_LABELS[key] || key}: ${value}`);
                    }
                }
                if (lines.length > 0) {
                    description += `\n\n--- Данные заявки ---\n${lines.join('\n')}`;
                }
            } catch (e) { }
        }
    }

    const deadline = getMoscowTime(2); // +2 часа от текущего момента

    const fields = {
        OWNER_TYPE_ID: 2,       // 2 = Сделка
        OWNER_ID: dealId,
        TYPE_ID: 2,             // 2 = Звонок (исходящий)
        DIRECTION: 2,           // 2 = Исходящий
        SUBJECT: `Установить контакт: ${contactName || phone}`,
        DESCRIPTION: description,
        RESPONSIBLE_ID: managerId || 1,
        PRIORITY: 2,            // 2 = Высокий приоритет
        // Bitrix24: DEADLINE для звонков = START_TIME (жёсткое поведение API)
        // Поэтому ставим START_TIME = +2ч, чтобы «Крайний срок» = +2 часа
        START_TIME: deadline,
        END_TIME: deadline,
        COMPLETED: 'N',
        COMMUNICATIONS: [{      // Обязательное поле!
            VALUE: phone || '',
            ENTITY_ID: contactId,
            ENTITY_TYPE_ID: 3,  // 3 = Контакт
            TYPE: 'PHONE',
        }],
    };

    const result = await callBitrix('crm.activity.add', { fields });
    const activityId = result.result;
    console.log(`✅ Дело создано в Bitrix24: ID ${activityId} (крайний срок: ${deadline})`);

    return activityId;
}

/**
 * Получить текущее время в формате Bitrix24 (Москва, UTC+3)
 * @param {number} addHours — сколько часов прибавить (0 = сейчас)
 */
function getMoscowTime(addHours = 0) {
    const now = new Date();
    // Переводим в московское время (UTC+3)
    const moscowOffset = 3 * 60; // +3 часа в минутах
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const moscow = new Date(utc + (moscowOffset * 60000));
    moscow.setHours(moscow.getHours() + addHours);

    // Формат: YYYY-MM-DDTHH:MM:SS+03:00
    const pad = (n) => String(n).padStart(2, '0');
    return `${moscow.getFullYear()}-${pad(moscow.getMonth() + 1)}-${pad(moscow.getDate())}T${pad(moscow.getHours())}:${pad(moscow.getMinutes())}:${pad(moscow.getSeconds())}+03:00`;
}

/**
 * Проверить, выполнена ли CRM-активность в Битриксе
 * @returns {boolean} true если активность закрыта (COMPLETED === 'Y')
 */
async function checkActivityCompleted(activityId) {
    try {
        const result = await callBitrix('crm.activity.get', { id: activityId });
        return result.result && result.result.COMPLETED === 'Y';
    } catch (error) {
        // Не ломаем систему при ошибке — просто пропускаем эту проверку
        console.error(`⚠️ Не удалось проверить активность ${activityId}:`, error.message);
        return false;
    }
}

module.exports = { createContactActivity, checkActivityCompleted, FIELD_LABELS };
