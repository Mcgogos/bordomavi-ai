const fs = require('fs');
const path = './src/app/(dashboard)/calendar/page.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
lines[229] = "            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (";
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log("Fixed with explicit UTF-8 and lines!");
