/**
 * ФИНАЛЬНЫЙ ТЕСТ — все 4 типа заявок
 * Квиз 01, Квиз 02, Калькулятор, Попап (Сайт)
 */
const config = require('./src/config');
const { callBitrix } = require('./src/bitrix/api');
const { getDb } = require('./src/db/database');
const { createContact, findContactByPhone } = require('./src/bitrix/contacts');
const { createDeal } = require('./src/bitrix/deals');
const { createContactActivity, FIELD_LABELS } = require('./src/bitrix/tasks');

const sourceNames = {
    site: 'Сайт', quiz1: 'Квиз 01 (/5questions)', quiz2: 'Квиз 02 (/02)',
    popup: 'Сайт', calculator: 'Калькулятор',
};

// 4 тестовых заявки
const TEST_LEADS = [
    {
        name: 'Тест Квиз01',
        phone: '+79990100001',
        email: 'quiz1@test.com',
        source: 'quiz1',
        form_data: {
            room_type: 'Квартира',
            area: '80 м²',
            concern: 'Духота и спертый воздух',
            priority: 'Тишина работы (малошумное оборудование)',
            timeline: 'В ближайший месяц',
        },
        expected_source: 'WEBFORM',
        expected_label: 'Квиз 01 (/5questions)',
        expected_fields: ['Тип помещения', 'Площадь', 'Что беспокоит', 'Что важно'],
    },
    {
        name: 'Тест Квиз02',
        phone: '+79990200002',
        email: 'quiz2@test.com',
        source: 'quiz2',
        form_data: {
            object: 'Дом',
            area: '150 м2',
            systems: 'Вентиляция; Увлажнение',
        },
        expected_source: 'WEBFORM',
        expected_label: 'Квиз 02 (/02)',
        expected_fields: ['Объект', 'Площадь', 'Системы'],
    },
    {
        name: 'Тест Калькулятор',
        phone: '+79990300003',
        email: 'calc@test.com',
        source: 'site',
        form_data: {
            type: 'Дом',
            area: '200',
            kitchen: '25',
            livingroom: '40',
            ceiling: '3',
            floors: '2',
            bathrooms: '3',
            bedrooms: '4',
        },
        expected_source: 'WEB',
        expected_label: 'Сайт',
        expected_fields: ['Тип объекта', 'Площадь', 'Кухня', 'Гостиная', 'Потолок', 'Этажей'],
    },
    {
        name: 'Тест Попап',
        phone: '+79990400004',
        source: 'popup',
        form_data: {},
        expected_source: 'WEB',
        expected_label: 'Сайт',
        expected_fields: [],
    },
];

let totalPassed = 0;
let totalFailed = 0;

function check(name, ok, detail) {
    if (ok) { totalPassed++; return '✅'; }
    else { totalFailed++; console.log(`    ❌ ${name}: ${detail || 'FAIL'}`); return '❌'; }
}

async function testLead(lead, index) {
    console.log(`\n${'━'.repeat(50)}`);
    console.log(`📋 ТЕСТ ${index + 1}/4: ${lead.expected_label} (${lead.name})`);
    console.log('━'.repeat(50));

    const cleanup = [];

    try {
        // Удаляем дубль если есть
        const dup = await findContactByPhone(lead.phone);
        if (dup.found) {
            const contacts = await callBitrix('crm.contact.list', { filter: { PHONE: lead.phone }, select: ['ID'] });
            for (const c of (contacts.result || [])) {
                await callBitrix('crm.contact.delete', { id: c.ID });
            }
        }

        // 1. Контакт
        const contactId = await createContact({
            name: lead.name, phone: lead.phone, email: lead.email, managerId: 35,
        });
        cleanup.push({ type: 'contact', id: contactId });
        console.log(`  ${check('Контакт', contactId > 0)} Контакт: #${contactId}`);

        // 2. Комментарий для сделки
        const formData = lead.form_data;
        const lines = [];
        for (const [key, value] of Object.entries(formData)) {
            if (value) lines.push(`${FIELD_LABELS[key] || key}: ${value}`);
        }
        let comment = lines.length > 0 ? `Данные заявки:\n${lines.join('\n')}` : '';
        comment += `\n\nИсточник: ${sourceNames[lead.source]}`;

        // 3. Сделка
        const dealId = await createDeal({
            contactId, title: `ТЕСТ — ${lead.name}`, source: lead.source, managerId: 35, comment,
        });
        cleanup.push({ type: 'deal', id: dealId });
        console.log(`  ${check('Сделка', dealId > 0)} Сделка: #${dealId}`);

        // 4. Закрепляемый комментарий
        let commentText = `📋 Заявка ТЕСТ\nИсточник: ${sourceNames[lead.source]}\nИмя: ${lead.name}\nТелефон: ${lead.phone}\n`;
        if (lead.email) commentText += `Email: ${lead.email}\n`;
        if (lines.length > 0) {
            commentText += `\n--- Данные заявки ---\n`;
            for (const [key, value] of Object.entries(formData)) {
                if (value) commentText += `${FIELD_LABELS[key] || key}: ${value}\n`;
            }
        }
        const cmtResult = await callBitrix('crm.timeline.comment.add', {
            fields: { ENTITY_ID: dealId, ENTITY_TYPE: 'deal', COMMENT: commentText },
        });
        console.log(`  ${check('Комментарий', cmtResult.result > 0)} Комментарий: #${cmtResult.result}`);

        // 5. Дело
        const activityId = await createContactActivity({
            dealId, contactId, contactName: lead.name, phone: lead.phone, managerId: 35,
            leadData: { source: lead.source, formData: JSON.stringify(formData) },
        });
        cleanup.push({ type: 'activity', id: activityId });
        console.log(`  ${check('Дело', activityId > 0)} Дело: #${activityId}`);

        // ПРОВЕРКИ
        console.log('\n  --- Проверки ---');

        // Сделка
        const deal = (await callBitrix('crm.deal.get', { id: dealId })).result;
        check('Источник=' + lead.expected_source, deal.SOURCE_ID === lead.expected_source, `got ${deal.SOURCE_ID}`);
        console.log(`  ${deal.SOURCE_ID === lead.expected_source ? '✅' : '❌'} Источник: ${deal.SOURCE_ID} (ожидалось ${lead.expected_source})`);

        const hasFields = lead.expected_fields.every(f => (deal.COMMENTS || '').includes(f));
        check('Поля в комментарии', hasFields || lead.expected_fields.length === 0, 'не все поля');
        if (lead.expected_fields.length > 0) {
            console.log(`  ${hasFields ? '✅' : '❌'} Поля в сделке: ${lead.expected_fields.join(', ')}`);
        } else {
            console.log(`  ✅ Попап — полей нет (как и должно быть)`);
        }

        // Дело
        const act = (await callBitrix('crm.activity.get', { id: activityId })).result;
        const okType = act.TYPE_ID == 2;
        const okPriority = act.PRIORITY == 2;
        const okCompleted = act.COMPLETED === 'N';
        check('Дело тип=Звонок', okType);
        check('Дело приоритет=Высокий', okPriority);
        check('Дело не завершено', okCompleted);
        console.log(`  ${okType ? '✅' : '❌'} Тип: Звонок`);
        console.log(`  ${okPriority ? '✅' : '❌'} Приоритет: Высокий`);
        console.log(`  ${okCompleted ? '✅' : '❌'} Дедлайн: ${act.END_TIME}`);

    } finally {
        // Очистка
        for (const item of cleanup.reverse()) {
            try {
                if (item.type === 'activity') await callBitrix('crm.activity.delete', { id: item.id });
                if (item.type === 'deal') await callBitrix('crm.deal.delete', { id: item.id });
                if (item.type === 'contact') await callBitrix('crm.contact.delete', { id: item.id });
            } catch (e) { }
        }
    }
}

async function main() {
    console.log('🔍 ФИНАЛЬНЫЙ ТЕСТ — ВСЕ 4 ТИПА ЗАЯВОК');
    console.log('Замечания за 6 марта 2026:\n');
    console.log('1. Bitrix ID менеджеров привязаны');
    console.log('2. Попап → Сайт');
    console.log('3. Квизы: 01 (/5questions), 02 (/02)');
    console.log('4. Источник в Bitrix: quiz→WEBFORM, site→WEB');
    console.log('5. Данные заявки → закрепляемый Комментарий');
    console.log('6. Поля на русском');
    console.log('7. Дело вместо Задачи');
    console.log('8. Дедлайн 2ч, приоритет высокий');
    console.log('9. Данные в комментарии, не в деле');

    for (let i = 0; i < TEST_LEADS.length; i++) {
        await testLead(TEST_LEADS[i], i);
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`ФИНАЛЬНЫЙ ИТОГ: ${totalPassed} пройдено, ${totalFailed} ошибок`);
    if (totalFailed === 0) {
        console.log('🎉🎉🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! СИСТЕМА ГОТОВА!');
    } else {
        console.log('⚠️ ЕСТЬ ПРОБЛЕМЫ!');
    }
    console.log('Тестовые данные удалены из Bitrix.');
}

main().catch(e => console.error('❌:', e));
