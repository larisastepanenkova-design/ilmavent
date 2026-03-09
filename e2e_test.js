/**
 * E2E тест: отправка заявки → взятие → проверка Bitrix
 * Имитируем полный цикл БЕЗ Telegram
 */
const config = require('./src/config');
const { callBitrix } = require('./src/bitrix/api');
const { getDb, initDatabase } = require('./src/db/database');
const { createContact, findContactByPhone } = require('./src/bitrix/contacts');
const { createDeal } = require('./src/bitrix/deals');
const { createContactActivity, FIELD_LABELS } = require('./src/bitrix/tasks');

async function main() {
    const db = getDb();
    console.log('🔍 E2E ТЕСТ: заявка → Bitrix\n');

    // Тестовые данные (имитация квиза 02)
    const testLead = {
        client_name: 'E2E Тест Авто',
        client_phone: '+79990009999',
        client_email: 'test@test.com',
        source: 'quiz2',
        form_data: JSON.stringify({
            object: 'Коттедж',
            area: '200 м2',
            systems: 'Вентиляция; Увлажнение; Кондиционирование',
        }),
        utm_source: 'yandex',
        utm_campaign: 'test_campaign',
    };

    // 1. Проверяем дубль
    console.log('1️⃣ Проверка дубля...');
    const dup = await findContactByPhone(testLead.client_phone);
    if (dup.found) {
        console.log('  ⚠️ Контакт уже есть, пропускаем создание');
        // Удалим для чистого теста
        console.log('  Удаляем для чистоты теста...');
        try {
            const contacts = await callBitrix('crm.contact.list', {
                filter: { PHONE: testLead.client_phone },
                select: ['ID'],
            });
            for (const c of (contacts.result || [])) {
                await callBitrix('crm.contact.delete', { id: c.ID });
                console.log(`  Удалён контакт #${c.ID}`);
            }
        } catch (e) { }
    }
    console.log('  ✅ Дубля нет\n');

    // 2. Создаём контакт
    console.log('2️⃣ Создание контакта...');
    const contactId = await createContact({
        name: testLead.client_name,
        phone: testLead.client_phone,
        email: testLead.client_email,
        managerId: 35, // Денис
    });
    console.log(`  ✅ Контакт создан: #${contactId}\n`);

    // 3. Формируем комментарий
    const sourceNames = {
        site: 'Сайт', quiz1: 'Квиз 01 (/5questions)', quiz2: 'Квиз 02 (/02)',
        popup: 'Попап', calculator: 'Калькулятор',
    };
    let dealComment = '';
    const formData = JSON.parse(testLead.form_data);
    const lines = [];
    for (const [key, value] of Object.entries(formData)) {
        if (value) {
            lines.push(`${FIELD_LABELS[key] || key}: ${value}`);
        }
    }
    if (lines.length > 0) dealComment = `Данные заявки:\n${lines.join('\n')}`;
    dealComment += `\n\nИсточник: ${sourceNames[testLead.source]}`;

    // 4. Создаём сделку
    console.log('3️⃣ Создание сделки...');
    const dealId = await createDeal({
        contactId,
        title: `E2E Тест — ${testLead.client_name}`,
        source: testLead.source,
        managerId: 35,
        comment: dealComment,
    });
    console.log(`  ✅ Сделка создана: #${dealId}\n`);

    // 5. Создаём комментарий (закрепляемый)
    console.log('4️⃣ Создание закрепляемого комментария...');
    let commentText = `📋 Заявка E2E\n`;
    commentText += `Источник: ${sourceNames[testLead.source]}\n`;
    commentText += `Имя: ${testLead.client_name}\n`;
    commentText += `Телефон: ${testLead.client_phone}\n`;
    commentText += `Email: ${testLead.client_email}\n`;
    commentText += `\n--- Данные заявки ---\n`;
    for (const [key, value] of Object.entries(formData)) {
        if (value) commentText += `${FIELD_LABELS[key] || key}: ${value}\n`;
    }
    commentText += `\nUTM source: ${testLead.utm_source}`;
    commentText += `\nUTM campaign: ${testLead.utm_campaign}`;

    const commentResult = await callBitrix('crm.timeline.comment.add', {
        fields: {
            ENTITY_ID: dealId,
            ENTITY_TYPE: 'deal',
            COMMENT: commentText,
        }
    });
    console.log(`  ✅ Комментарий создан: #${commentResult.result}\n`);

    // 6. Создаём дело
    console.log('5️⃣ Создание дела (исходящий звонок)...');
    const activityId = await createContactActivity({
        dealId,
        contactId,
        contactName: testLead.client_name,
        phone: testLead.client_phone,
        managerId: 35,
        leadData: {
            source: testLead.source,
            formData: testLead.form_data,
        },
    });
    console.log(`  ✅ Дело создано: #${activityId}\n`);

    // 7. Проверяем что сделка содержит правильные данные
    console.log('6️⃣ Проверка сделки в Bitrix...');
    const deal = await callBitrix('crm.deal.get', { id: dealId });
    const d = deal.result;
    console.log(`  Название: ${d.TITLE}`);
    console.log(`  Источник: ${d.SOURCE_ID}`);
    console.log(`  SOURCE_DESCRIPTION: ${d.SOURCE_DESCRIPTION}`);
    console.log(`  Ответственный: ${d.ASSIGNED_BY_ID}`);
    console.log(`  Комментарий: ${(d.COMMENTS || '').substring(0, 100)}...`);

    const ok_source = d.SOURCE_ID === 'WEBFORM';
    const ok_title = d.TITLE.includes('E2E');
    const ok_manager = d.ASSIGNED_BY_ID == 35;
    const ok_comments = d.COMMENTS && d.COMMENTS.includes('Объект') && d.COMMENTS.includes('Площадь');

    console.log(`\n  Источник = WEBFORM: ${ok_source ? '✅' : '❌'}`);
    console.log(`  Название корректное: ${ok_title ? '✅' : '❌'}`);
    console.log(`  Менеджер = Денис (35): ${ok_manager ? '✅' : '❌'}`);
    console.log(`  Комментарий содержит данные: ${ok_comments ? '✅' : '❌'}`);

    // 8. Проверяем дело
    console.log('\n7️⃣ Проверка дела...');
    const activity = await callBitrix('crm.activity.get', { id: activityId });
    const a = activity.result;
    console.log(`  Тема: ${a.SUBJECT}`);
    console.log(`  Тип: ${a.TYPE_ID} (2=Звонок)`);
    console.log(`  Приоритет: ${a.PRIORITY} (2=Высокий)`);
    console.log(`  Ответственный: ${a.RESPONSIBLE_ID}`);
    console.log(`  Завершено: ${a.COMPLETED}`);
    console.log(`  Дедлайн: ${a.END_TIME}`);

    const ok_type = a.TYPE_ID == 2;
    const ok_priority = a.PRIORITY == 2;
    const ok_completed = a.COMPLETED === 'N';

    console.log(`\n  Тип = Звонок: ${ok_type ? '✅' : '❌'}`);
    console.log(`  Приоритет = Высокий: ${ok_priority ? '✅' : '❌'}`);
    console.log(`  Не завершено: ${ok_completed ? '✅' : '❌'}`);

    // Итог
    const all = [ok_source, ok_title, ok_manager, ok_comments, ok_type, ok_priority, ok_completed];
    const passedCount = all.filter(Boolean).length;
    console.log(`\n${'='.repeat(40)}`);
    console.log(`E2E ИТОГО: ${passedCount}/${all.length} проверок`);
    if (passedCount === all.length) {
        console.log('🎉 E2E ТЕСТ ПРОЙДЕН ПОЛНОСТЬЮ!');
    } else {
        console.log('⚠️ ЕСТЬ ПРОБЛЕМЫ!');
    }

    // Очистка — удаляем тестовые данные из Bitrix
    console.log('\n🧹 Очистка тестовых данных...');
    try {
        await callBitrix('crm.activity.delete', { id: activityId });
        await callBitrix('crm.deal.delete', { id: dealId });
        await callBitrix('crm.contact.delete', { id: contactId });
        console.log('  ✅ Тестовые данные удалены из Bitrix');
    } catch (e) {
        console.log('  ⚠️ Частичная очистка: ' + e.message);
    }
}

main().catch(e => console.error('❌ Ошибка теста:', e));
