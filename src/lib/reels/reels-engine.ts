import { stripExternalSources, sanitizePlainText } from "@/lib/content/content-generator";
import { OFFICIAL_MANAGER, OFFICIAL_2026_2027_SQUAD } from "@/lib/squad/squad-service";

export interface ReelScene {
  index: number;
  timeRange: string;
  durationSeconds: number;
  name: string;
  color: string;
  badge: string;
  caption: string;
  speechText: string;
}

export interface SuggestedVisual {
  id: string;
  type: 'NEWS' | 'PLAYER' | 'STADIUM' | 'FANS' | 'ACTION' | 'CANVA';
  label: string;
  url: string;
  description: string;
}

export interface GeneratedReel {
  title: string;
  summary: string;
  category: string;
  scenes: ReelScene[];
  fullNarration: string;
  suggestedVisuals: SuggestedVisual[];
  facebookCaption: string;
}

// 9:16 Dikey Formatlı Yüksek Çözünürlüklü Tematik Trabzonspor & Futbol Arka Plan Havuzu
const CURATED_VERTICAL_SLIDES = {
  stadium: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1080&h=1920&q=80',
  fans: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1080&h=1920&q=80',
  playerAction: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1080&h=1920&q=80',
  celebration: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1080&h=1920&q=80',
  pitchNight: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1080&h=1920&q=80',
  transferBall: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1080&h=1920&q=80',
  tactics: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1080&h=1920&q=80',
};

/**
 * Haberin içeriğini Reels süresine (~20 saniye) göre özetleyen,
 * eksiksiz ve akıcı tek parça Türkçe seslendirme senaryosu ve 5-6 görselli slayt havuzu üreten motor.
 */
export function generateDynamicReelScript(params: {
  title: string;
  summary?: string;
  body?: string;
  imageUrl?: string;
}): GeneratedReel {
  const cleanTitle = sanitizePlainText(params.title || '');
  let cleanBody = sanitizePlainText(params.body || params.summary || '');
  
  // Dış bağlantı ve "devamı için..." kalıntılarını temizle
  cleanBody = cleanBody
    .replace(/(haberin\s+)?(devamı|ayrıntıları|detayları)\s+için\s+(tıklayınız|tıklayın|buraya\s+tıklayın)[\.\…]*/gi, '')
    .replace(/\b(devamı|detaylar)\s+için\s+tıklayın\b/gi, '')
    .replace(/\bdevamı\s+için\b/gi, '')
    .trim();

  const combinedText = `${cleanTitle} ${cleanBody}`.toLowerCase();

  // 1. Kategori ve Konu Tespiti
  let category = 'NEWS';
  let hookTitle = '🔥 Trabzonspor\'da Flaş Gelişme!';
  let hookSpeech = 'Trabzonspor\'da yer yerinden oynuyor! Bordo-mavili kulüpte sıcak saatler yaşanıyor.';
  let mainEntity = 'Trabzonspor';

  if (combinedText.includes('transfer') || combinedText.includes('imza') || combinedText.includes('bonservis') || combinedText.includes('anlaşma')) {
    category = 'TRANSFER';
    hookTitle = '🚨 Bordo-Mavi\'de Transfer Bombası!';
    hookSpeech = 'Bordo-Mavili renklere gönül verenler ekran başına! Trabzonspor\'da flaş bir transfer hamlesi gerçekleşti.';
    mainEntity = 'transfer';
  } else if (combinedText.includes('thomas reis') || combinedText.includes('reis') || combinedText.includes('teknik direktör')) {
    category = 'COACH';
    hookTitle = '⚡ Thomas Reis\'ten Tarihi Karar!';
    hookSpeech = 'Teknik direktörümüz Thomas Reis son kararını verdi. Bordo-Mavili kulüpte önemli gelişmeler var.';
    mainEntity = 'Thomas Reis';
  } else if (combinedText.includes('savic') || combinedText.includes('saviç')) {
    category = 'DEFENSE';
    hookTitle = '🛡️ Stefan Savić Gündemde!';
    hookSpeech = 'Savunmanın tecrübeli lideri Stefan Saviç hakkında önemli son dakika gelişmesi yaşandı.';
    mainEntity = 'Stefan Savić';
  } else if (combinedText.includes('banza')) {
    category = 'STRIKER';
    hookTitle = '⚽ Simon Banza\'dan Çarpıcı Mesaj!';
    hookSpeech = 'Golcü santrforumuz Simon Banza hakkında sıcak gelişmeler var. Taraftarlar heyecanla takip ediyor.';
    mainEntity = 'Simon Banza';
  } else if (combinedText.includes('uğurcan') || combinedText.includes('ugurcan')) {
    category = 'KEEPER';
    hookTitle = '🧤 Kaptan Uğurcan Çakır Gündemde!';
    hookSpeech = 'Kaptanımız Uğurcan Çakır ile ilgili flaş kulis bilgileri ortaya çıktı.';
    mainEntity = 'Uğurcan Çakır';
  } else if (combinedText.includes('nwakaeme') || combinedText.includes('tony')) {
    category = 'ATTACK';
    hookTitle = '🪄 Anthony Nwakaeme Sahnede!';
    hookSpeech = 'Sihirbaz Anthony Nwakaeme Bordo-Mavili taraftarları yeniden heyecanlandırdı.';
    mainEntity = 'Anthony Nwakaeme';
  } else if (combinedText.includes('sakat') || combinedText.includes('tedavi') || combinedText.includes('ameliyat')) {
    category = 'INJURY';
    hookTitle = '⚠️ Fırtına\'da Revir Alarmı!';
    hookSpeech = 'Trabzonspor sağlık heyetinden kritik bir bilgilendirme yapıldı.';
  }

  // 2. Akıcı ve Doyurucu Konuşma Metni Hazırlığı (Kesintisiz Türkçe TTS için tek parça)
  // Haber gövdesinden en kilit 1-2 cümleyi damıt
  let coreFact = cleanTitle;
  if (coreFact.length > 100) coreFact = coreFact.slice(0, 95) + '...';

  // Detay cümlesi: temizlenmiş gövdeden anlamlı bir bölüm
  let detailSummary = cleanBody.replace(cleanTitle, '').trim();
  if (detailSummary.length > 130) {
    // İlk noktalı cümleyi yakala
    const firstPeriod = detailSummary.indexOf('.');
    if (firstPeriod > 40 && firstPeriod < 120) {
      detailSummary = detailSummary.slice(0, firstPeriod + 1);
    } else {
      detailSummary = detailSummary.slice(0, 115) + '...';
    }
  }
  if (!detailSummary || detailSummary.length < 20) {
    detailSummary = 'Bordo-Mavili yönetim ve teknik heyet bu doğrultuda çalışmalarını titizlikle sürdürüyor.';
  }

  const ctaSpeech = 'Peki siz bu gelişmeyi nasıl değerlendiriyorsunuz? Yorumlarda buluşalım, takipte kalın!';
  const ctaCaption = '💬 Sizce bu karar doğru mu? Yorumlarda buluşalım, takipte kalın!';

  // BİRLEŞİK, KESİNTİSİZ SESLENDİRME METNİ (~45-55 kelime, tam 18-20 saniye akıcı Türkçe)
  const fullNarration = `${hookSpeech} ${coreFact}. ${detailSummary} ${ctaSpeech}`;

  // 3. Zaman Eşzamanlı 4 Sahne (Görsel Altyazı ve Rozetler İçin)
  const scenes: ReelScene[] = [
    {
      index: 1,
      timeRange: '0-4 sn',
      durationSeconds: 4,
      name: '1. Giriş & Kanca',
      color: 'text-amber-400',
      badge: 'Flaş Giriş',
      caption: hookTitle,
      speechText: hookSpeech,
    },
    {
      index: 2,
      timeRange: '4-9 sn',
      durationSeconds: 5,
      name: '2. Manşet & Gelişme',
      color: 'text-white',
      badge: 'Ana Gelişme',
      caption: cleanTitle,
      speechText: coreFact,
    },
    {
      index: 3,
      timeRange: '9-15 sn',
      durationSeconds: 6,
      name: '3. Perde Arkası & Detay',
      color: 'text-sky-300',
      badge: 'Perde Arkası',
      caption: detailSummary,
      speechText: detailSummary,
    },
    {
      index: 4,
      timeRange: '15-20 sn',
      durationSeconds: 5,
      name: '4. Yorum & Etkileşim Çağrısı',
      color: 'text-emerald-400',
      badge: 'Tartışma Kancası',
      caption: ctaCaption,
      speechText: ctaSpeech,
    }
  ];

  // 4. Reels İçin 5-6 Görselden Oluşan Dinamik Slayt Havuzu
  // Relative URL client-side'da her zaman 0 gecikmeyle çalışır
  const dynamicCanvaOgUrl = `/api/og?title=${encodeURIComponent(cleanTitle)}&template=REELS&format=vertical${params.imageUrl ? `&imageUrl=${encodeURIComponent(params.imageUrl)}` : ''}`;

  const suggestedVisuals: SuggestedVisual[] = [
    {
      id: 'canva-vertical',
      type: 'CANVA',
      label: '1. 9:16 Dikey HD Afiş (Otomatik BordoMavi)',
      url: dynamicCanvaOgUrl,
      description: 'Habere özel başlık, logo ve degrade içeren dikey kapak görseli.'
    }
  ];

  // Görsel 2: Varsa haber orijinal fotoğrafı, yoksa oyuncu aksiyon fotoğrafı
  if (params.imageUrl) {
    suggestedVisuals.push({
      id: 'news-image',
      type: 'NEWS',
      label: '2. Haber Orijinal Fotoğrafı',
      url: params.imageUrl,
      description: 'Habere ait orijinal basın görseli.'
    });
  } else {
    suggestedVisuals.push({
      id: 'player-action',
      type: 'PLAYER',
      label: '2. Yıldız Oyuncu / Hoca Aksiyon',
      url: CURATED_VERTICAL_SLIDES.playerAction,
      description: 'Bordo-Mavili futbolcu aksiyon fotoğrafı.'
    });
  }

  // Görsel 3: Papara Park Stadyumu & Maç Atmosferi
  suggestedVisuals.push({
    id: 'stadium-night',
    type: 'STADIUM',
    label: '3. Papara Park Stadyumu (Gece)',
    url: CURATED_VERTICAL_SLIDES.stadium,
    description: 'Papara Park maç gecesi ışıkları ve stadyum atmosferi.'
  });

  // Görsel 4: Coşkulu Trabzonspor Taraftarları & Bayraklar
  suggestedVisuals.push({
    id: 'fans-passion',
    type: 'FANS',
    label: '4. Bordo-Mavi Tribün & Meşaleler',
    url: CURATED_VERTICAL_SLIDES.fans,
    description: 'Trabzonspor taraftarının coşkulu tribün görüntüsü.'
  });

  // Görsel 5: Gol Sevinci & Takım Ruhu
  suggestedVisuals.push({
    id: 'team-celebration',
    type: 'ACTION',
    label: '5. Fırtına Gol Sevinci',
    url: CURATED_VERTICAL_SLIDES.celebration,
    description: 'Bordo-Mavili oyuncuların sevinç ve kenetlenme anı.'
  });

  // Görsel 6: Saha İçi Gece Işıkları & Mücadele
  suggestedVisuals.push({
    id: 'pitch-tactics',
    type: 'ACTION',
    label: '6. Taktik Mücadele & Zemin',
    url: CURATED_VERTICAL_SLIDES.pitchNight,
    description: 'Saha içi odak ve maç temposu görseli.'
  });

  // 5. Facebook Reels Paylaşım Açıklaması
  const facebookCaption = `🎬 BORDO MAVİ REELS | ${cleanTitle}\n\n${cleanBody}\n\n${ctaCaption}\n\n#Trabzonspor #BordoMavi #Reels #Shorts #Fırtına #SüperLig`;

  return {
    title: cleanTitle,
    summary: cleanBody.substring(0, 150),
    category,
    scenes,
    fullNarration,
    suggestedVisuals,
    facebookCaption,
  };
}
