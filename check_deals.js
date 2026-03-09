const config = require('./src/config');
const { callBitrix } = require('./src/bitrix/api');

async function main() {
    // Последние 5 сделок
    const deals = await callBitrix('crm.deal.list', {
        order: { ID: 'DESC' },
        select: ['ID', 'TITLE', 'COMMENTS', 'SOURCE_ID', 'SOURCE_DESCRIPTION'],
        start: 0,
    });
    console.log('=== Последние сделки ===');
    deals.result.slice(0, 5).forEach(d => {
        console.log(`#${d.ID} | ${d.TITLE} | Источник: ${d.SOURCE_ID} | Описание: ${d.SOURCE_DESCRIPTION || '-'}`);
        if (d.COMMENTS) console.log(`  Комментарий: ${d.COMMENTS.substring(0, 200)}`);
    });

    // Комментарии к последней сделке
    const lastDealId = deals.result[0].ID;
    console.log(`\n=== Timeline сделки #${lastDealId} ===`);
    try {
        const timeline = await callBitrix('crm.timeline.comment.list', {
            filter: { ENTITY_ID: lastDealId, ENTITY_TYPE: 'deal' },
        });
        console.log(JSON.stringify(timeline.result, null, 2));
    } catch (e) {
        console.log('Timeline error:', e.message);
    }

    // Ищем сделку с подробными данными (не тестовую)
    const realDeals = await callBitrix('crm.deal.list', {
        order: { ID: 'ASC' },
        filter: { '>ID': 0 },
        select: ['ID', 'TITLE', 'COMMENTS'],
        start: 0,
    });
    console.log('\n=== Все сделки с комментариями ===');
    realDeals.result.forEach(d => {
        if (d.COMMENTS) {
            console.log(`#${d.ID} ${d.TITLE}:`);
            console.log(d.COMMENTS);
            console.log('---');
        }
    });
}
main();
