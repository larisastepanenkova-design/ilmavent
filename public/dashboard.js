// ===== Конфигурация =====
const REFRESH_MS = 30000; // Обновление каждые 30 секунд
const API_URL = '/api/leads';

// ===== Элементы DOM =====
const grid = document.getElementById('leads-grid');
const emptyState = document.getElementById('empty-state');
const statTotal = document.getElementById('stat-total');
const statTaken = document.getElementById('stat-taken');
const statNew = document.getElementById('stat-new');
const clockEl = document.getElementById('clock');
const lastUpdateEl = document.getElementById('last-update');

// ===== Часы =====
function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('ru-RU', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ===== Источники на русском =====
const sourceLabels = {
    site: 'Сайт',
    quiz1: 'Квиз 1',
    quiz2: 'Квиз 2',
    popup: 'Попап',
    calculator: 'Калькулятор',
    whatsapp: 'WhatsApp',
    email: 'Почта',
    telegram: 'Telegram',
};

// ===== Форматирование таймера =====
function formatTimer(createdAt) {
    const created = new Date(createdAt + 'Z'); // сервер хранит UTC, явно указываем
    const now = new Date();
    const diffMs = now - created;
    const diffMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    if (hours > 0) {
        return `${hours}ч ${String(mins).padStart(2, '0')}м`;
    }
    return `${mins}м`;
}

// ===== Определить цвет по времени =====
function getColor(lead) {
    if (lead.status === 'new') return 'new'; // ещё не взята

    const takenAt = new Date(lead.taken_at + 'Z'); // сервер хранит UTC
    const now = new Date();
    const diffMin = (now - takenAt) / 60000;

    // Пороги из конфига сервера (2ч = 120мин, 6ч = 360мин)
    if (diffMin >= 360) return 'red';
    if (diffMin >= 120) return 'yellow';
    return 'green';
}

// ===== Создать HTML карточки =====
function createCard(lead) {
    const color = getColor(lead);
    const isNew = lead.status === 'new';

    const cardClass = isNew ? 'card card--new' : `card card--${color}`;
    const timerStart = isNew ? lead.created_at : lead.taken_at;
    const sourceLabel = sourceLabels[lead.source] || lead.source;
    const initial = lead.manager_name ? lead.manager_name.charAt(0) : '';

    return `
    <div class="${cardClass}" data-id="${lead.id}">
      <div class="card-header">
        <span class="card-id">#${lead.id}</span>
        <span class="card-source">${sourceLabel}</span>
      </div>
      <div class="card-name">${lead.client_name || 'Без имени'}</div>
      <div class="card-footer">
        ${isNew
            ? '<span class="card-manager card-manager--empty">⏳ Ожидает менеджера</span>'
            : `<span class="card-manager">
              <span class="card-manager-icon">${initial}</span>
              ${lead.manager_name}
            </span>`
        }
        <span class="card-timer">${formatTimer(timerStart)}</span>
      </div>
    </div>
  `;
}

// ===== Обновить дашборд =====
async function refreshDashboard() {
    try {
        const res = await fetch(API_URL);
        const leads = await res.json();

        // Статистика
        const newLeads = leads.filter(l => l.status === 'new');
        const takenLeads = leads.filter(l => l.status === 'taken');

        statTotal.textContent = leads.length;
        statTaken.textContent = takenLeads.length;
        statNew.textContent = newLeads.length;

        // Пустое состояние
        if (leads.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
        } else {
            grid.style.display = 'grid';
            emptyState.style.display = 'none';

            // Сортировка: новые → красные → жёлтые → зелёные
            const priority = { new: 0, red: 1, yellow: 2, green: 3 };
            leads.sort((a, b) => {
                const ca = a.status === 'new' ? 'new' : getColor(a);
                const cb = b.status === 'new' ? 'new' : getColor(b);
                return (priority[ca] ?? 4) - (priority[cb] ?? 4);
            });

            grid.innerHTML = leads.map(createCard).join('');
        }

        lastUpdateEl.textContent = `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;
    } catch (err) {
        console.error('Ошибка загрузки:', err);
        lastUpdateEl.textContent = `Ошибка: ${err.message}`;
    }
}

// ===== Обновление таймеров каждую минуту =====
function refreshTimers() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        // Переопределяем цвета при каждом обновлении
    });
}

// ===== Запуск =====
refreshDashboard();
setInterval(refreshDashboard, REFRESH_MS);
// Обновляем таймеры чаще для плавности
setInterval(refreshDashboard, 60000);
