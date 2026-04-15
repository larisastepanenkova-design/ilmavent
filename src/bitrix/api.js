const axios = require('axios');
const config = require('../config');

const BITRIX_URL = config.bitrix.webhookUrl;

// --- Rate limiter ---
// Bitrix24 позволяет не более 2 запросов в секунду.
// Очередь гарантирует последовательную отправку с паузой 600мс между запросами.
// При ошибке — retry с exponential backoff (макс. 3 попытки).

const queue = [];
let processing = false;
const MIN_INTERVAL_MS = 600;   // пауза между запросами (< 2 req/sec)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;    // начальная задержка retry (1с → 2с → 4с)

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Поставить запрос в очередь и дождаться результата
 */
function callBitrix(method, params = {}) {
    return new Promise((resolve, reject) => {
        queue.push({ method, params, resolve, reject });
        processQueue();
    });
}

/**
 * Обработчик очереди — выполняет запросы последовательно
 */
async function processQueue() {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
        const { method, params, resolve, reject } = queue.shift();

        let lastError;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const url = `${BITRIX_URL}${method}`;
                const response = await axios.post(url, params);
                resolve(response.data);
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
                const isRateLimit = error.response && error.response.status === 429;
                const isServerError = error.response && error.response.status >= 500;
                const isNetwork = !error.response; // ECONNRESET, timeout и т.д.

                if (attempt < MAX_RETRIES && (isRateLimit || isServerError || isNetwork)) {
                    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    console.warn(`⚠️ Bitrix API (${method}): попытка ${attempt}/${MAX_RETRIES} не удалась — ${error.message}. Повтор через ${delay}мс`);
                    await sleep(delay);
                } else {
                    console.error(`❌ Bitrix24 API ошибка (${method}): ${error.message} [попытка ${attempt}/${MAX_RETRIES}]`);
                }
            }
        }

        if (lastError) {
            reject(lastError);
        }

        // Пауза между запросами
        await sleep(MIN_INTERVAL_MS);
    }

    processing = false;
}

/**
 * Получить текущее состояние очереди (для мониторинга)
 */
function getQueueStatus() {
    return {
        pending: queue.length,
        processing,
    };
}

module.exports = { callBitrix, getQueueStatus };
