const { callBitrix } = require('./api');

/**
 * Создать контакт в Bitrix24
 */
async function createContact({ name, phone, email, managerId }) {
    const fields = {
        NAME: name || 'Без имени',
        PHONE: phone ? [{ VALUE: phone, VALUE_TYPE: 'WORK' }] : [],
        EMAIL: email ? [{ VALUE: email, VALUE_TYPE: 'WORK' }] : [],
        ASSIGNED_BY_ID: managerId || 1,
        SOURCE_ID: 'WEB',
    };

    const result = await callBitrix('crm.contact.add', { fields });
    console.log(`✅ Контакт создан в Bitrix24: ID ${result.result}`);
    return result.result; // ID нового контакта
}

/**
 * Поиск контакта по номеру телефона (проверка дублей)
 */
async function findContactByPhone(phone) {
    // Нормализуем: оставляем только цифры
    const digits = phone.replace(/\D/g, '');

    const result = await callBitrix('crm.duplicate.findbycomm', {
        type: 'PHONE',
        values: [phone, digits, `+${digits}`],
        entity_type: 'CONTACT',
    });

    if (result.result && result.result.CONTACT && result.result.CONTACT.length > 0) {
        const contactId = result.result.CONTACT[0];
        // Получаем имя ответственного
        const contact = await callBitrix('crm.contact.get', { id: contactId });
        const assignedId = contact.result.ASSIGNED_BY_ID;

        // Получаем имя менеджера
        const user = await callBitrix('user.get', { ID: assignedId });
        const managerName = user.result[0]
            ? `${user.result[0].NAME} ${user.result[0].LAST_NAME}`
            : 'Неизвестный';

        return { found: true, contactId, managerName };
    }

    return { found: false };
}

module.exports = { createContact, findContactByPhone };
