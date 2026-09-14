const fs = require('fs');
const path = './src/app/(dashboard)/calendar/page.tsx';
let content = fs.readFileSync(path, 'utf8');
// Replace the broken line with the correct one
content = content.replace(/\{.*?Pzt.*?Sal.*?ar.*?Per.*?\}/, "{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (");
fs.writeFileSync(path, content, 'utf8');
console.log("Fixed!");
