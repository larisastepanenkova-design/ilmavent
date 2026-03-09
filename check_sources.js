const config = require('./src/config');
const { callBitrix } = require('./src/bitrix/api');

async function main() {
    const result = await callBitrix('crm.status.list', { filter: { ENTITY_ID: 'SOURCE' } });
    console.log('Источники в Bitrix24:');
    result.result.forEach(s => console.log(`  ${s.STATUS_ID} = ${s.NAME}`));
}
main();
