/**
 * Тест залповой нагрузки
 *
 * Имитирует ситуацию, когда Тильда сбрасывает 20 заявок одновременно
 * (как произошло 12 апреля 2026).
 *
 * Запуск: node test_stress.js [url]
 * По умолчанию: http://localhost:3000
 *
 * ВАЖНО: используйте тестовые номера (начинаются с +7999),
 * чтобы не засорять продакшен.
 */

const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const LEAD_COUNT = 20;

const sources = ['site', 'quiz1', 'quiz2'];

function generateLead(index) {
    const source = sources[index % sources.length];
    const phone = `+7999${String(index).padStart(7, '0')}`;

    if (source === 'site') {
        return {
            _source: 'site',
            Name: `Тест Стресс ${index}`,
            Phone: phone,
            Email: `test${index}@stress.test`,
            type: 'Квартира',
            area: String(50 + index * 10),
            kitchen: '15',
            ceiling: '280',
            floors: '1',
            bathrooms: '1',
            bedrooms: String(1 + (index % 4)),
        };
    }

    if (source === 'quiz1') {
        return {
            _source: 'quiz1',
            Name: `Тест Стресс ${index}`,
            Phone: phone,
            object: 'Квартира',
            area: String(60 + index * 5),
            systems: 'Приточная вентиляция',
        };
    }

    return {
        _source: 'quiz2',
        Name: `Тест Стресс ${index}`,
        Phone: phone,
        room_type: 'Квартира',
        concern: 'Духота, нехватка свежего воздуха',
        priority: 'Тишина работы системы',
        timeline: 'В ближайший месяц',
    };
}

function postLead(lead) {
    return new Promise((resolve, reject) => {
        const url = new URL('/webhook/lead', BASE_URL);
        const data = JSON.stringify(lead);

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: JSON.parse(body) });
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log(`\n🔥 Стресс-тест: ${LEAD_COUNT} заявок одновременно → ${BASE_URL}\n`);
    console.log('Отправляю...');

    const start = Date.now();

    // Отправляем ВСЕ заявки одновременно (имитация залпа Тильды)
    const promises = [];
    for (let i = 1; i <= LEAD_COUNT; i++) {
        const lead = generateLead(i);
        promises.push(
            postLead(lead)
                .then(res => ({ index: i, ...res }))
                .catch(err => ({ index: i, error: err.message }))
        );
    }

    const results = await Promise.all(promises);
    const elapsed = Date.now() - start;

    // Статистика
    const ok = results.filter(r => r.status === 200 && r.body?.status === 'ok');
    const duplicates = results.filter(r => r.body?.status === 'duplicate');
    const errors = results.filter(r => r.error || r.status !== 200);

    console.log(`\n📊 Результат за ${elapsed}мс:`);
    console.log(`   ✅ Принято: ${ok.length}`);
    console.log(`   ⚠️ Дубли: ${duplicates.length}`);
    console.log(`   ❌ Ошибки: ${errors.length}`);

    if (errors.length > 0) {
        console.log('\nОшибки:');
        errors.forEach(e => console.log(`   #${e.index}: ${e.error || JSON.stringify(e.body)}`));
    }

    // Проверяем очередь
    try {
        const statusRes = await new Promise((resolve, reject) => {
            http.get(`${BASE_URL}/api/status`, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(JSON.parse(body)));
            }).on('error', reject);
        });
        console.log(`\n📋 Состояние очередей:`);
        console.log(`   Заявки: ${statusRes.leadQueue.pending} в ожидании, обработано: ${statusRes.leadQueue.processedCount}`);
        console.log(`   Bitrix: ${statusRes.bitrixQueue.pending} в ожидании`);
    } catch (e) {
        console.log(`\n⚠️ Не удалось получить статус: ${e.message}`);
    }

    console.log('\n✅ Тест завершён. Проверьте Telegram-канал и дашборд.\n');
}

run().catch(console.error);
