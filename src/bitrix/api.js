const axios = require('axios');
const config = require('../config');

const BITRIX_URL = config.bitrix.webhookUrl;

/**
 * Вызвать метод Bitrix24 REST API
 */
async function callBitrix(method, params = {}) {
    try {
        const url = `${BITRIX_URL}${method}`;
        const response = await axios.post(url, params);
        return response.data;
    } catch (error) {
        console.error(`❌ Bitrix24 API ошибка (${method}):`, error.message);
        throw error;
    }
}

module.exports = { callBitrix };
