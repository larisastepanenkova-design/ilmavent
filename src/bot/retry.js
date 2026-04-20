// Retry-обёртка для исходящих вызовов Telegram API.
//
// Why: 15.04.2026 и 20.04.2026 DNS-сбой на хостинге положил отправку заявок
// в группу — Bitrix был защищён очередью с backoff, Telegram нет, заявки
// исчезали без следа. Эта обёртка страхует от транзиентных сетевых блипов.
//
// Применяется только к outbound-вызовам (publishLead, notifyManager,
// sendReport). НЕ применять к answerCbQuery / editMessageText внутри
// callback-хендлеров: Telegram даёт ~15 сек на ответ, после чего возвращает
// 400 "query is too old" — retry всё испортит.

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1с → 2с → 4с

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ретраим только транзиентные сетевые ошибки и 5xx от Telegram.
 * 4xx (400 query is too old, 403 bot blocked и т.п.) — НЕ ретраим.
 */
function isRetryable(err) {
    if (!err) return false;
    // TelegramError: успешный HTTP-ответ с API-ошибкой внутри
    if (err.response && typeof err.response.error_code === 'number') {
        return err.response.error_code >= 500;
    }
    // Нет response → сеть: EAI_AGAIN, ECONNRESET, ENOTFOUND, ETIMEDOUT, socket hang up
    return true;
}

/**
 * Выполнить fn с retry при транзиентных ошибках
 */
async function withTelegramRetry(label, fn) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < MAX_RETRIES && isRetryable(err)) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`⚠️ Telegram (${label}): попытка ${attempt}/${MAX_RETRIES} — ${err.message}. Повтор через ${delay}мс`);
                await sleep(delay);
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

module.exports = { withTelegramRetry, isRetryable };
