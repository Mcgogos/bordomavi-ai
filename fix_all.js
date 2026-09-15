const fs = require('fs');
const path = require('path');

const replacements = {
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
  'Ã‡': 'Ç',
  'Ǭ': 'ü',
  '': 'ç'
};

const wordReplacements = {
  'Haber AkY': 'Haber Akışı',
  'erik Merkezi': 'İçerik Merkezi',
  'Editr': 'Editör',
  'Gvenlik': 'Güvenlik',
  'k Yap': 'Çıkış Yap',
  '-ZEL HABER': 'ÖZEL HABER',
  'SON DAKKA': 'SON DAKİKA',
  'TRANSFER ATE?': 'TRANSFER ATEŞİ',
  'MA GoNo': 'MAÇ GÜNÜ',
  'BordoMavi<s': 'BordoMavi<s',
  'erik': 'İçerik',
  'nerileri': 'önerileri',
  'retilen': 'Üretilen',
  '?ampiyonlukYolunda': 'ŞampiyonlukYolunda',
  'Avc': 'Avcı',
  '-Yle': 'Öğle',
  'EtkileYim': 'Etkileşim',
  'ArtY': 'Artışı',
  'BaYarl': 'Başarılı',
  'TǬrleri': 'Türleri',
  'gǬnlǬk': 'günlük',
  'oranlarna': 'oranlarına',
  'YǬkselen': 'Yükselen',
  'Taraftarn': 'Taraftarın',
  'ok': 'çok',
  'ilgilendiYi': 'ilgilendiği',
  'Gzlemi': 'Gözlemi',
  'gǬn': 'gün',
  'iindeki': 'içindeki',
  'ma': 'maç',
  'sonras': 'sonrası',
  'yaplan': 'yapılan',
  'ksa': 'kısa',
  'dǬz': 'düz',
  'alyor': 'alıyor',
  '-nǬmǬzdeki': 'Önümüzdeki',
  'gǬnlerde': 'günlerde',
  'grsel': 'görsel',
  'aYrlkl': 'ağırlıklı',
  'ieriklere': 'içeriklere',
  'odaklanma': 'odaklanma',
  'Tarafndan': 'Tarafından',
  'oretilen': 'Üretilen',
  'Ma': 'Maç',
  'Sylentileri': 'Söylentileri',
  'KulǬp': 'Kulüp',
  'Aklamalar': 'Açıklamaları',
  'gre': 'göre',
  'Geen': 'Geçen',
  'iin': 'için',
  'dayal': 'dayalı'
};

function fixDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      fixDir(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      let orig = content;
      
      for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
      }
      for (const [bad, good] of Object.entries(wordReplacements)) {
        content = content.split(bad).join(good);
      }
      
      if (content !== orig) {
        fs.writeFileSync(p, content, 'utf8');
        console.log("Fixed:", p);
      }
    }
  }
}

fixDir('src/app');
fixDir('src/components');
fixDir('src/lib');