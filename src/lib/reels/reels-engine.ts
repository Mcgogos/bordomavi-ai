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
  type: 'NEWS' | 'PLAYER' | 'STADIUM' | 'CANVA';
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

// Curated high quality vertical action visuals for Trabzonspor entities
const ENTITY_VISUALS: Record<string, string> = {
  'thomas_reis': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1080&q=80',
  'simon_banza': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1080&q=80',
  'stefan_savic': 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1080&q=80',
  'ugurcan_cakir': 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1080&q=80',
  'edin_visca': 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1080&q=80',
  'anthony_nwakaeme': 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1080&q=80',
  'papara_park': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1080&q=80',
  'transfer': 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1080&q=80',
};

/**
 * Verilen haber metnini 15-20 saniyelik profesyonel dikey Reels senaryosuna dönüştürür.
 * Sahne sahne dinamik seslendirme metni ve internet görsel önerileri üretir.
 */
export function generateDynamicReelScript(params: {
  title: string;
  summary?: string;
  body?: string;
  imageUrl?: string;
}): GeneratedReel {
  const cleanTitle = sanitizePlainText(params.title || '');
  const cleanBody = sanitizePlainText(params.body || params.summary || '');
  const combinedText = `${cleanTitle} ${cleanBody}`.toLowerCase();

  // 1. Kategori ve Konu Tespiti
  let category = 'NEWS';
  let hookTitle = '🔥 Trabzonspor\'da Flaş Gelişme!';
  let hookSpeech = 'Trabzonspor\'da yer yerinden oynuyor! İşte son dakika haberinin perde arkası:';
  let detectedEntityKey = 'papara_park';

  if (combinedText.includes('transfer') || combinedText.includes('imza') || combinedText.includes('bonservis') || combinedText.includes('anlaşma')) {
    category = 'TRANSFER';
    hookTitle = '🚨 Bordo-Mavi\'de Transfer Bombası!';
    hookSpeech = 'Bordo-Mavi renklere gönül verenler ekran başına! İşte Trabzonspor\'un yeni transfer hamlesi:';
    detectedEntityKey = 'transfer';
  } else if (combinedText.includes('thomas reis') || combinedText.includes('reis') || combinedText.includes('teknik direktör')) {
    category = 'COACH';
    hookTitle = '⚡ Thomas Reis\'ten Tarihi Karar!';
    hookSpeech = 'Teknik direktörümüz Thomas Reis son kararını verdi! İşte o flaş açıklama:';
    detectedEntityKey = 'thomas_reis';
  } else if (combinedText.includes('savic') || combinedText.includes('saviç')) {
    category = 'DEFENSE';
    hookTitle = '🛡️ Stefan Savić\'ten Sıcak Haber!';
    hookSpeech = 'Savunmanın lideri Stefan Saviç hakkında önemli gelişme! İşte detaylar:';
    detectedEntityKey = 'stefan_savic';
  } else if (combinedText.includes('banza')) {
    category = 'STRIKER';
    hookTitle = '⚽ Simon Banza\'dan Çarpıcı Mesaj!';
    hookSpeech = 'Golcü santrforumuz Simon Banza hakkında sıcak saatler! İşte yaşananlar:';
    detectedEntityKey = 'simon_banza';
  } else if (combinedText.includes('uğurcan') || combinedText.includes('ugurcan')) {
    category = 'KEEPER';
    hookTitle = '🧤 Kaptan Uğurcan Çakır Gündemde!';
    hookSpeech = 'Kaptanımız Uğurcan Çakır ile ilgili flaş gelişme! İşte kulislerden sızan ilk bilgiler:';
    detectedEntityKey = 'ugurcan_cakir';
  } else if (combinedText.includes('nwakaeme') || combinedText.includes('tony')) {
    category = 'ATTACK';
    hookTitle = '🪄 Anthony Nwakaeme Sahnede!';
    hookSpeech = 'Sihirbaz Anthony Nwakaeme\'den Bordo-Mavili taraftarları heyecanlandıran haber:';
    detectedEntityKey = 'anthony_nwakaeme';
  } else if (combinedText.includes('sakat') || combinedText.includes('tedavi') || combinedText.includes('ameliyat')) {
    category = 'INJURY';
    hookTitle = '⚠️ Fırtına\'da Revir Alarmı!';
    hookSpeech = 'Trabzonspor sağlık heyetinden son dakika bilgilendirmesi yapıldı:';
  }

  // 2. Sahne Metinlerini Özetleme (Reels Zamanlama Prensibi)
  // Sahne 2: Manşet & İlk Detay (3-8 sn)
  const scene2Caption = cleanTitle;
  const scene2Speech = cleanTitle.length > 90 ? cleanTitle.substring(0, 90) + '...' : cleanTitle;

  // Sahne 3: Perde Arkası (8-14 sn)
  let scene3Caption = cleanBody.length > 120 ? cleanBody.substring(0, 120) + '...' : cleanBody;
  if (!scene3Caption || scene3Caption === scene2Caption) {
    scene3Caption = 'Bordo-Mavili kulüpte sıcak saatler yaşanıyor. Taraftarlar heyecanla sürecin netleşmesini bekliyor.';
  }
  const scene3Speech = scene3Caption;

  // Sahne 4: Viral Yorum Çağrısı (14-18 sn)
  const scene4Caption = '💬 Sizce bu karar doğru mu? (EVET / HAYIR) Fikrinizi yoruma yazın, takipte kalın!';
  const scene4Speech = 'Bordo-Mavili taraftarlar, siz bu kararı destekliyor musunuz? Fikrinizi hemen yorumlarda belirtin, sayfamızı takip etmeyi unutmayın!';

  const scenes: ReelScene[] = [
    {
      index: 1,
      timeRange: '0-3 sn',
      durationSeconds: 3,
      name: '1. Kanca (Hook)',
      color: 'text-amber-400',
      badge: 'Flaş Giriş',
      caption: hookTitle,
      speechText: hookSpeech,
    },
    {
      index: 2,
      timeRange: '3-8 sn',
      durationSeconds: 5,
      name: '2. Gelişme & Manşet',
      color: 'text-white',
      badge: 'Ana Haber',
      caption: scene2Caption,
      speechText: scene2Speech,
    },
    {
      index: 3,
      timeRange: '8-14 sn',
      durationSeconds: 6,
      name: '3. Detay & Perde Arkası',
      color: 'text-sky-300',
      badge: 'Önemli Detay',
      caption: scene3Caption,
      speechText: scene3Speech,
    },
    {
      index: 4,
      timeRange: '14-18 sn',
      durationSeconds: 4,
      name: '4. Eylem Çağrısı (CTA)',
      color: 'text-emerald-400',
      badge: 'Yorum Kancası',
      caption: scene4Caption,
      speechText: scene4Speech,
    }
  ];

  // 3. Kesintisiz Seslendirme Metni
  const fullNarration = `${hookSpeech} ${scene2Speech} ${scene3Speech} ${scene4Speech}`;

  // 4. Dinamik Görsel Önerileri (Haber Görseli, İlgili Futbolcu/Hoca, Papara Park, 9:16 Dikey Canva)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai.vercel.app';
  const dynamicCanvaOgUrl = `${appUrl}/api/og?title=${encodeURIComponent(cleanTitle)}&template=REELS&format=vertical${params.imageUrl ? `&imageUrl=${encodeURIComponent(params.imageUrl)}` : ''}`;

  const suggestedVisuals: SuggestedVisual[] = [];

  // Öncelik 1: Orijinal Haber Görseli (varsa)
  if (params.imageUrl) {
    suggestedVisuals.push({
      id: 'news-image',
      type: 'NEWS',
      label: 'Haber Orijinal Görseli',
      url: params.imageUrl,
      description: 'Haber kaynağındaki doğrudan fotoğraf.'
    });
  }

  // Öncelik 2: 9:16 Dikey Akıllı BordoMavi Şablonu
  suggestedVisuals.push({
    id: 'canva-vertical',
    type: 'CANVA',
    label: '9:16 Dikey HD Afiş (Otomatik)',
    url: dynamicCanvaOgUrl,
    description: 'Logo, tipografi ve bordo-mavi gradyan içeren dikey format.'
  });

  // Öncelik 3: Tespit edilen oyuncu veya stadyum görseli
  const matchedVisual = ENTITY_VISUALS[detectedEntityKey] || ENTITY_VISUALS['papara_park'];
  suggestedVisuals.push({
    id: 'entity-photo',
    type: 'PLAYER',
    label: detectedEntityKey === 'papara_park' ? 'Papara Park Atmosfer' : 'İlgili Futbolcu / Hoca Özel Fotoğraf',
    url: matchedVisual,
    description: 'İçerikle birebir eşleşen HD dikey arka plan.'
  });

  // Öncelik 4: Stadyum Genel
  if (detectedEntityKey !== 'papara_park') {
    suggestedVisuals.push({
      id: 'stadium-bg',
      type: 'STADIUM',
      label: 'Papara Park Maç Gecesi',
      url: ENTITY_VISUALS['papara_park'],
      description: 'Tribün ve stadyum atmosfer görseli.'
    });
  }

  // 5. Facebook Reels Paylaşım Açıklaması
  const facebookCaption = `🎬 BORDO MAVİ REELS | ${cleanTitle}\n\n${cleanBody}\n\n${scene4Caption}\n\n#Trabzonspor #BordoMavi #Reels #Shorts #Fırtına #SüperLig`;

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
