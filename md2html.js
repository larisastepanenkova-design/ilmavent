const fs = require('fs');
const md = fs.readFileSync('e:/Проекты/ilmavent/ПАСПОРТ_ПРОЕКТА.md', 'utf8');
const lines = md.split(/\r?\n/);

const bold = (t) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

let body = '';
let inTable = false;

for (let l of lines) {
    l = l.replace(/\r/g, '');

    if (l.startsWith('|')) {
        if (/^\|[\s\-|:]+$/.test(l)) continue;
        const cells = l.split('|').slice(1, -1).map(c => c.trim());
        if (!inTable) {
            body += '<table><tr>';
            cells.forEach(c => { body += '<th>' + bold(c) + '</th>'; });
            body += '</tr>';
            inTable = true;
        } else {
            body += '<tr>';
            cells.forEach(c => { body += '<td>' + bold(c) + '</td>'; });
            body += '</tr>';
        }
    } else {
        if (inTable) { body += '</table>'; inTable = false; }
        if (l.startsWith('# ')) body += '<h1>' + bold(l.slice(2)) + '</h1>';
        else if (l.startsWith('## ')) body += '<h2>' + bold(l.slice(3)) + '</h2>';
        else if (l.startsWith('### ')) body += '<h3>' + bold(l.slice(4)) + '</h3>';
        else if (l.startsWith('---')) body += '<hr>';
        else if (/^\d+\. /.test(l)) body += '<p class="li">' + bold(l) + '</p>';
        else if (l.startsWith('- ')) body += '<p class="li">' + bold(l.slice(2)) + '</p>';
        else if (l.trim()) body += '<p>' + bold(l) + '</p>';
    }
}
if (inTable) body += '</table>';

// Оборачиваем контакт + подписи в единый блок
body = body.replace(
    /(<p><strong>Контакт разработчика:<\/strong>)/,
    '<div class="nobreak"><p><strong>Контакт разработчика:</strong>'
);
body = body.replace(
    /(<p><strong>Дата:<\/strong>[^<]+<\/p>)/,
    '$1</div>'
);

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Паспорт проекта</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 760px; margin: 30px auto; padding: 20px; line-height: 1.5; color: #222; font-size: 13.5px; }
  h1 { text-align: center; font-size: 22px; border-bottom: 3px solid #333; padding-bottom: 10px; }
  h2 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 5px; margin-top: 28px; font-size: 17px; page-break-after: avoid; }
  h3 { color: #2e86c1; margin-top: 18px; font-size: 14px; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 15px 0; page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; font-size: 13px; }
  th { background: #eef3f8; font-weight: bold; }
  tr:nth-child(even) { background: #f9f9f9; }
  hr { border: none; border-top: 1px solid #ccc; margin: 18px 0; }
  p { margin: 4px 0; }
  p.li { margin: 3px 0 3px 20px; }
  strong { color: #1a5276; }
  .nobreak { page-break-inside: avoid; }
  @media print {
    body { margin: 0; padding: 10px 20px; }
    table { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
    h2, h3 { page-break-after: avoid; }
    .nobreak { page-break-inside: avoid; }
  }
</style></head><body>
${body}
</body></html>`;

fs.writeFileSync('e:/Проекты/ilmavent/ПАСПОРТ_ПРОЕКТА.html', html, 'utf8');
console.log('OK');
