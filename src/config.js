require('dotenv').config();

module.exports = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
  },

  // Bitrix24
  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL,
  },

  // Почта
  imap: {
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT) || 993,
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
  },

  // Сервер
  server: {
    port: parseInt(process.env.PORT) || 3000,
  },

  // Пороги времени (в минутах)
  thresholds: {
    yellow: parseInt(process.env.YELLOW_THRESHOLD) || 120,  // 2 часа
    red: parseInt(process.env.RED_THRESHOLD) || 360,        // 6 часов
  },

  // Ночной режим (часы)
  nightMode: {
    start: parseInt(process.env.NIGHT_START) || 21,  // 21:00
    end: parseInt(process.env.NIGHT_END) || 6,       // 06:00
  },

  // Ограничения менеджеров
  limits: {
    maxRedTasks: 7,           // Больше 7 красных → кнопка неактивна
    redZoneStrikes: 3,        // 3 раза в красной зоне → блокировка
    blockDurationDays: 7,     // Блокировка на 7 дней
  },

  // Дашборд
  dashboard: {
    refreshInterval: 30000,   // Обновление каждые 30 секунд
  },
};
