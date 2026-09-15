import os
import codecs

def fix_encoding(root_dir):
    replacements = {
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
        '': 'ç'
    }
    
    # Also fix some words with '' or specific known bad patterns.
    word_replacements = {
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
        'BaYarl': 'Başarılı',
        'iin': 'için',
        'dayal': 'dayalı'
    }

    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(('.tsx', '.ts')):
                filepath = os.path.join(dirpath, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    original_content = content
                    for bad, good in replacements.items():
                        content = content.replace(bad, good)
                    
                    for bad, good in word_replacements.items():
                        content = content.replace(bad, good)
                        
                    if content != original_content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Fixed encoding in: {filepath}")
                except Exception as e:
                    print(f"Failed {filepath}: {e}")

if __name__ == '__main__':
    fix_encoding('src/app')
    fix_encoding('src/components')
    fix_encoding('src/lib')