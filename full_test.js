/**
 * Полный тест системы — проверка всех замечаний
 */
const config = require('./src/config');
const { callBitrix } = require('./src/bitrix/api');
const { getDb } = require('./src/db/database');
const { FIELD_LABELS } = require('./src/bitrix/tasks');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}: ${detail || 'FAILED'}`);
        failed++;
    }
}

async function main() {
    console.log('🔍 ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ\n');

    // 1. Bitrix ID менеджеров
    console.log('--- 1. Bitrix ID менеджеров ---');
    const db = getDb();
    const managers = db.prepare('SELECT id, name, bitrix_user_id FROM managers').all();
    const expected = { 'Арсений': 21, 'Антон': 73, 'Денис': 35, 'Дмитрий': 87, 'Александр': 123 };
    managers.forEach(m => {
        check(`${m.name} → Bitrix ID ${m.bitrix_user_id}`, m.bitrix_user_id === expected[m.name],
            `ожидалось ${expected[m.name]}, получено ${m.bitrix_user_id}`);
    });

    // 2. Колонка is_paused
    console.log('\n--- 2. Колонка is_paused ---');
    try {
        db.prepare('SELECT is_paused FROM managers LIMIT 1').get();
        check('Колонка is_paused существует', true);
    } catch (e) {
        check('Колонка is_paused существует', false, e.message);
    }

    // 3. Маппинг полей на русский
    console.log('\n--- 3. Маппинг полей на русский ---');
    check('object → Объект', FIELD_LABELS.object === 'Объект');
    check('area → Площадь', FIELD_LABELS.area === 'Площадь');
    check('systems → Системы', FIELD_LABELS.systems === 'Системы');
    check('room_type → Тип помещения', FIELD_LABELS.room_type === 'Тип помещения');
    check('kitchen → Кухня', FIELD_LABELS.kitchen === 'Кухня');
    check('livingroom → Гостиная', FIELD_LABELS.livingroom === 'Гостиная');
    check('ceiling → Потолок', FIELD_LABELS.ceiling === 'Потолок');
    check('floors → Этажей', FIELD_LABELS.floors === 'Этажей');
    check('bathrooms → Санузлов', FIELD_LABELS.bathrooms === 'Санузлов');
    check('bedrooms → Спален', FIELD_LABELS.bedrooms === 'Спален');

    // 4. Названия квизов в telegram.js
    console.log('\n--- 4. Названия квизов ---');
    const fs = require('fs');
    const telegramCode = fs.readFileSync('./src/bot/telegram.js', 'utf8');
    check('Квиз 01 (/5questions) в коде', telegramCode.includes('Квиз 01 (/5questions)'));
    check('Квиз 02 (/02) в коде', telegramCode.includes('Квиз 02 (/02)'));

    // 5. Источники Bitrix
    console.log('\n--- 5. Маппинг источников Bitrix ---');
    const dealsCode = fs.readFileSync('./src/bitrix/deals.js', 'utf8');
    check('site → WEB', dealsCode.includes("'site': 'WEB'"));
    check('quiz1 → WEBFORM', dealsCode.includes("'quiz1': 'WEBFORM'"));
    check('quiz2 → WEBFORM', dealsCode.includes("'quiz2': 'WEBFORM'"));

    // 6. Дело вместо Задачи
    console.log('\n--- 6. Дело вместо Задачи ---');
    const tasksCode = fs.readFileSync('./src/bitrix/tasks.js', 'utf8');
    check('crm.activity.add (Дело)', tasksCode.includes('crm.activity.add'));
    check('НЕ tasks.task.add (Задача)', !tasksCode.includes('tasks.task.add'));
    check('TYPE_ID: 2 (Звонок)', tasksCode.includes('TYPE_ID: 2'));
    check('Дедлайн 2 часа', tasksCode.includes('getHours() + 2'));
    check('PRIORITY: 2 (Высокий)', tasksCode.includes('PRIORITY: 2'));
    check('COMMUNICATIONS обязателен', tasksCode.includes('COMMUNICATIONS'));

    // 7. Комментарий crm.timeline.comment.add
    console.log('\n--- 7. Закрепляемый комментарий ---');
    check('crm.timeline.comment.add в коде', telegramCode.includes('crm.timeline.comment.add'));
    check('ENTITY_TYPE: deal', telegramCode.includes("ENTITY_TYPE: 'deal'"));

    // 8. Под-админы
    console.log('\n--- 8. Под-админы ---');
    const adminCode = fs.readFileSync('./src/bot/admin.js', 'utf8');
    check('Люда @IlmaMontazh в постоянных под-админах', adminCode.includes('@IlmaMontazh'));
    check('SUB_ADMIN_USERNAMES массив', adminCode.includes('SUB_ADMIN_USERNAMES'));

    // 9. Тест API Bitrix24
    console.log('\n--- 9. Тест API Bitrix24 ---');
    try {
        const test = await callBitrix('crm.deal.list', { select: ['ID'], start: 0 });
        check('Bitrix24 API доступен', test.result && test.result.length > 0);
    } catch (e) {
        check('Bitrix24 API доступен', false, e.message);
    }

    // 10. Тест crm.activity.add
    console.log('\n--- 10. Тест создания Дела ---');
    try {
        const result = await callBitrix('crm.activity.add', {
            fields: {
                OWNER_TYPE_ID: 2,
                OWNER_ID: 10519,
                TYPE_ID: 2,
                DIRECTION: 2,
                SUBJECT: 'Системный тест - удалить',
                DESCRIPTION: 'Тест',
                RESPONSIBLE_ID: 1,
                START_TIME: new Date().toISOString(),
                END_TIME: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                COMPLETED: 'N',
                PRIORITY: 2,
                COMMUNICATIONS: [{ VALUE: '+70000000000', ENTITY_ID: 10209, ENTITY_TYPE_ID: 3, TYPE: 'PHONE' }],
            }
        });
        check('crm.activity.add работает', result.result > 0, `ID: ${result.result}`);
        // Удаляем тестовое дело
        await callBitrix('crm.activity.delete', { id: result.result });
    } catch (e) {
        check('crm.activity.add работает', false, e.message);
    }

    // 11. Тест crm.timeline.comment.add
    console.log('\n--- 11. Тест комментария ---');
    try {
        const result = await callBitrix('crm.timeline.comment.add', {
            fields: {
                ENTITY_ID: 10519,
                ENTITY_TYPE: 'deal',
                COMMENT: 'Системный тест - удалить',
            }
        });
        check('crm.timeline.comment.add работает', result.result > 0);
        await callBitrix('crm.timeline.comment.delete', { id: result.result, ownerTypeId: 2, ownerId: 10519 });
    } catch (e) {
        check('crm.timeline.comment.add работает', false, e.message);
    }

    // Итог
    console.log(`\n${'='.repeat(40)}`);
    console.log(`ИТОГО: ${passed} пройдено, ${failed} ошибок`);
    if (failed === 0) {
        console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!');
    } else {
        console.log('⚠️ ЕСТЬ ПРОБЛЕМЫ — ИСПРАВИТЬ!');
    }
}

main().catch(e => console.error('Ошибка теста:', e));
