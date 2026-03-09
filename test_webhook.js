const http = require('http');
const data = JSON.stringify({
    Name: 'Тест Дело',
    Phone: '+79990002222',
    'На_каком_объекте_планируете_монтаж': 'Офис',
    'Площадь_объекта': '120 м2',
    'Какие_системы_хотите_сделать': 'Вентиляция; Увлажнение',
});
const req = http.request({
    hostname: 'localhost', port: 3000, path: '/webhook/lead',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
}, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => console.log(res.statusCode, body));
});
req.write(data);
req.end();
