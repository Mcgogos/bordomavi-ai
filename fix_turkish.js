const fs = require('fs');
const path = require('path');

// Sadece double-encoded UTF-8 Türkçe karakterler (kesin eşleşme)
const map = [
  ['Ä±', 'ı'], ['ÄŸ', 'ğ'], ['Ã¼', 'ü'], ['ÅŸ', 'ş'],
  ['Ã¶', 'ö'], ['Ã§', 'ç'], ['Ä°', 'İ'], ['Äž', 'Ğ'],
  ['Ãœ', 'Ü'], ['Åž', 'Ş'], ['Ã–', 'Ö'], ['Ã‡', 'Ç'],
];

// Ek bilinen bozuk stringler (manuel tespit)
const extras = [
  ['GǬvenlik', 'Güvenlik'], ['KulǬp', 'Kulüp'], ['gǬn', 'gün'],
  ['dǬz', 'düz'], ['TǬrleri', 'Türleri'], ['gǬnlǬk', 'günlük'],
  ['YǬkselen', 'Yükselen'], ['gǬnlerde', 'günlerde'],
  ['-nǬmǬzdeki', 'Önümüzdeki'], ['gǬ', 'gü'],
];

let totalFixed = 0;
const fixedFiles = [];

function fixDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(entry.name)) fixDir(full);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      const orig = content;
      for (const [bad, good] of map) content = content.split(bad).join(good);
      for (const [bad, good] of extras) content = content.split(bad).join(good);
      if (content !== orig) {
        fs.writeFileSync(full, content, 'utf8');
        totalFixed++;
        fixedFiles.push(full.replace(process.cwd() + path.sep, ''));
      }
    }
  }
}

fixDir('src');
fixDir('netlify');
console.log('Düzeltilen dosya sayısı:', totalFixed);
fixedFiles.forEach(f => console.log(' -', f));