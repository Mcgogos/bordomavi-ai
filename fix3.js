const fs = require('fs');
const path = require('path');

const map = {
  'Ä±': 'ı',
  'ÄŸ': 'ğ',
  'Ã¼': 'ü',
  'ÅŸ': 'ş',
  'Ã¶': 'ö',
  'Ã§': 'ç',
  'Ä°': 'İ',
  'Äž': 'Ğ',
  'Ãœ': 'Ü',
  'Åž': 'Ş',
  'Ã–': 'Ö',
  'Ã‡': 'Ç'
};

function fixFile(p) {
  let content = fs.readFileSync(p, 'utf8');
  for (const [bad, good] of Object.entries(map)) {
    content = content.split(bad).join(good);
  }
  fs.writeFileSync(p, content, 'utf8');
}

fixFile('src/app/(dashboard)/analytics/page.tsx');
fixFile('src/app/(dashboard)/strategy/page.tsx');