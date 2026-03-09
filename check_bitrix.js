const config = require('./src/config');
const https = require('https');
const url = config.bitrix.webhookUrl + 'user.get?ACTIVE=true';
https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const users = JSON.parse(data).result;
        users.forEach(u => console.log(`ID: ${u.ID} | ${u.NAME} ${u.LAST_NAME}`));
    });
});
