/**
 * Тест: Источник=РК для Сайт, Квиз1, Квиз2
 * + проверка дедлайна +2 часа
 */
const { callBitrix } = require('./src/bitrix/api');
const { createContact, findContactByPhone } = require('./src/bitrix/contacts');
const { createDeal } = require('./src/bitrix/deals');
const { createContactActivity } = require('./src/bitrix/tasks');

const TEST_LEADS = [
    { name: 'Тест Сайт РК', phone: '+79997770001', source: 'site', expected_desc: 'Сайт' },
    { name: 'Тест Квиз1 РК', phone: '+79997770002', source: 'quiz1', expected_desc: 'Квиз1' },
    { name: 'Тест Квиз2 РК', phone: '+79997770003', source: 'quiz2', expected_desc: 'Квиз2' },
];

let passed = 0, failed = 0;

async function main() {
    console.log('🔍 ТЕСТ: Источник=РК + Дедлайн +2ч\n');
    const cleanup = [];

    for (const lead of TEST_LEADS) {
        console.log(`\n━━━ ${lead.expected_desc} (${lead.source}) ━━━`);

        // Удаляем дубли
        const dup = await findContactByPhone(lead.phone);
        if (dup.found) {
            const contacts = await callBitrix('crm.contact.list', { filter: { PHONE: lead.phone }, select: ['ID'] });
            for (const c of (contacts.result || [])) await callBitrix('crm.contact.delete', { id: c.ID });
        }

        // Контакт
        const contactId = await createContact({ name: lead.name, phone: lead.phone, managerId: 1 });
        cleanup.push({ type: 'contact', id: contactId });

        // Сделка
        const dealId = await createDeal({
            contactId, title: `ТЕСТ РК — ${lead.name}`, source: lead.source, managerId: 1,
            comment: `Источник: ${lead.expected_desc}`,
        });
        cleanup.push({ type: 'deal', id: dealId });

        // Дело (Activity)
        const activityId = await createContactActivity({
            dealId, contactId, contactName: lead.name, phone: lead.phone, managerId: 1,
            leadData: { source: lead.source },
        });
        cleanup.push({ type: 'activity', id: activityId });

        // --- ПРОВЕРКИ ---
        const deal = (await callBitrix('crm.deal.get', { id: dealId })).result;
        const act = (await callBitrix('crm.activity.get', { id: activityId })).result;

        // 1. Источник = РК (UC_RK)
        const srcOk = deal.SOURCE_ID === 'UC_RK';
        console.log(`  ${srcOk ? '✅' : '❌'} Источник: ${deal.SOURCE_ID} (ожидалось UC_RK)`);
        srcOk ? passed++ : failed++;

        // 2. РК (описание) = Сайт/Квиз1/Квиз2
        const descOk = deal.SOURCE_DESCRIPTION === lead.expected_desc;
        console.log(`  ${descOk ? '✅' : '❌'} РК описание: "${deal.SOURCE_DESCRIPTION}" (ожидалось "${lead.expected_desc}")`);
        descOk ? passed++ : failed++;

        // 3. Дедлайн дела +2 часа от текущего момента
        const deadline = new Date(act.DEADLINE || act.END_TIME);
        const now = new Date();
        const diffHours = (deadline - now) / 3600000;
        const dlOk = diffHours > 1.5 && diffHours < 2.5;  // допуск ±30 мин
        console.log(`  ${dlOk ? '✅' : '❌'} Крайний срок: ${act.DEADLINE} (+${diffHours.toFixed(1)}ч от сейчас)`);
        dlOk ? passed++ : failed++;
    }

    // Очистка
    console.log('\n🧹 Удаляю тестовые данные...');
    for (const item of cleanup.reverse()) {
        try {
            if (item.type === 'activity') await callBitrix('crm.activity.delete', { id: item.id });
            if (item.type === 'deal') await callBitrix('crm.deal.delete', { id: item.id });
            if (item.type === 'contact') await callBitrix('crm.contact.delete', { id: item.id });
        } catch (e) { }
    }

    console.log(`\n${'═'.repeat(40)}`);
    console.log(`ИТОГ: ${passed} ✅ пройдено, ${failed} ❌ ошибок`);
    if (failed === 0) console.log('🎉 ВСЁ РАБОТАЕТ КАК НАДО!');
    else console.log('⚠️ ЕСТЬ ПРОБЛЕМЫ!');
}

main().catch(e => console.error('❌:', e));
