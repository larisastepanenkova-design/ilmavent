/**
 * Очередь обработки заявок
 *
 * При залповом поступлении заявок от Тильды (например, после сбоя)
 * вебхук сразу отвечает 200 OK и сохраняет заявку в БД,
 * а обработка (Telegram + дубли) идёт последовательно через эту очередь.
 *
 * Это предотвращает:
 * - перегрузку Telegram API
 * - одновременные запросы к Bitrix при проверке дублей
 * - зависание бота при массовом поступлении
 */

const DELAY_BETWEEN_LEADS_MS = 1000; // пауза 1 сек между заявками

const queue = [];
let processing = false;
let processedCount = 0;
let errorCount = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Добавить заявку в очередь на обработку
 * @param {Function} handler — async-функция обработки (вызывается без аргументов)
 */
function enqueue(handler) {
    queue.push(handler);
    processQueue();
}

/**
 * Обработчик очереди — вызывает функции последовательно
 */
async function processQueue() {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
        const handler = queue.shift();
        try {
            await handler();
            processedCount++;
        } catch (err) {
            errorCount++;
            console.error('❌ Ошибка в очереди заявок:', err.message);
        }

        if (queue.length > 0) {
            await sleep(DELAY_BETWEEN_LEADS_MS);
        }
    }

    processing = false;
}

/**
 * Статус очереди (для мониторинга / API)
 */
function getLeadQueueStatus() {
    return {
        pending: queue.length,
        processing,
        processedCount,
        errorCount,
    };
}

module.exports = { enqueue, getLeadQueueStatus };
