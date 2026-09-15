const fs = require('fs');

function cleanAnalytics() {
  let c = fs.readFileSync('src/app/(dashboard)/analytics/page.tsx', 'utf8');
  c = c.replace(/Sistemin genel performans.*/, 'Sistemin genel performansı ve AI başarı metrikleri.</p>');
  c = c.replace(/..lenen Toplam Haber/, 'İşlenen Toplam Haber');
  c = c.replace(/RSS kaynaklar.ndan .ekildi/, 'RSS kaynaklarından çekildi');
  c = c.replace(/..retilen ..erik/, 'Üretilen İçerik');
  c = c.replace(/Yapay zeka taraf.ndan yaz.ld./, 'Yapay zeka tarafından yazıldı');
  c = c.replace(/Yay.nlanan ..erik/, 'Yayınlanan İçerik');
  c = c.replace(/Facebook'ta payla..ld./, "Facebook'ta paylaşıldı");
  c = c.replace(/..erik kalite ortalamas./, 'İçerik kalite ortalaması');
  c = c.replace(/Detayl. Grafikler Haz.rlan.yor/, 'Detaylı Grafikler Hazırlanıyor');
  c = c.replace(/Daha fazla etkile.im verisi topland...nda burada grafikler aktif olacakt.r/, 'Daha fazla etkileşim verisi toplandığında burada grafikler aktif olacaktır');
  fs.writeFileSync('src/app/(dashboard)/analytics/page.tsx', c);
}

function cleanStrategy() {
  let c = fs.readFileSync('src/app/(dashboard)/strategy/page.tsx', 'utf8');
  c = c.replace(/Ma. Analizi/g, 'Maç Analizi');
  c = c.replace(/S.ylentileri/g, 'Söylentileri');
  c = c.replace(/Kul.p A.klamalar./g, 'Kulüp Açıklamaları');
  c = c.replace(/U.urcan.ak.r/g, 'UğurcanÇakır');
  c = c.replace(/\.ampiyonlukYolunda/g, 'ŞampiyonlukYolunda');
  c = c.replace(/Avc./g, 'Avcı');
  c = c.replace(/Ma. Sonu/g, 'Maç Sonu');
  c = c.replace(/\..le Aras./g, 'Öğle Arası');
  c = c.replace(/i.in veriye dayal. i.erik .nerileri/g, 'için veriye dayalı içerik önerileri');
  c = c.replace(/g.ne g.re/g, 'güne göre');
  c = c.replace(/..erik Etkile.im Art.../g, 'İçerik Etkileşim Artışı');
  c = c.replace(/Ge.en haftaya/g, 'Geçen haftaya');
  c = c.replace(/En Ba.ar.l. ..erik T.rleri/g, 'En Başarılı İçerik Türleri');
  c = c.replace(/g.nl.k etkile.im oranlar.na g.re/g, 'günlük etkileşim oranlarına göre');
  c = c.replace(/Y.kselen Trendler/g, 'Yükselen Trendler');
  c = c.replace(/Taraftar.n en .ok ilgilendi.i/g, 'Taraftarın en çok ilgilendiği');
  c = c.replace(/Otomatik AI G.zlemi/g, 'Otomatik AI Gözlemi');
  c = c.replace(/i.indeki verilere g.re, ma. sonras. yap.lan k.sa/g, 'içindeki verilere göre, maç sonrası yapılan kısa');
  c = c.replace(/d.z metin haberlere g.re .140 daha fazla etkile.im al.yor/g, 'düz metin haberlere göre %140 daha fazla etkileşim alıyor');
  c = c.replace(/\.n.m.zdeki g.nlerde g.rsel a..rl.kl. i.eriklere odaklanman.z/g, 'Önümüzdeki günlerde görsel ağırlıklı içeriklere odaklanmanız');
  c = c.replace(/AI Taraf.ndan .retilen Stratejiler/g, 'AI Tarafından Üretilen Stratejiler');
  c = c.replace(/g.rsel/g, 'görsel');
  fs.writeFileSync('src/app/(dashboard)/strategy/page.tsx', c);
}

cleanAnalytics();
cleanStrategy();