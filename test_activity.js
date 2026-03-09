const config = require('./src/config');
const { callBitrix } = require('./src/bitrix/api');

async function main() {
    try {
        const result = await callBitrix('crm.activity.add', {
            fields: {
                OWNER_TYPE_ID: 2,
                OWNER_ID: 10519,
                TYPE_ID: 2,        // Звонок
                DIRECTION: 2,      // Исходящий
                SUBJECT: 'Установить контакт: Тест',
                DESCRIPTION: 'Данные заявки:\nОбъект: Квартира\nПлощадь: 80 м2\nСистемы: Вентиляция',
                RESPONSIBLE_ID: 35,
                START_TIME: new Date().toISOString(),
                END_TIME: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                COMPLETED: 'N',
                PRIORITY: 2,
                COMMUNICATIONS: [{
                    VALUE: '+79990001111',
                    ENTITY_ID: 10209,
                    ENTITY_TYPE_ID: 3,
                    TYPE: 'PHONE',
                }],
            }
        });
        console.log('OK:', JSON.stringify(result));
    } catch (e) {
        console.error('Ошибка:', e.response ? JSON.stringify(e.response.data) : e.message);
    }
}
main();
