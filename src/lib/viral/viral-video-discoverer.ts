import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/db';
import { getFFmpegPath } from '../reels/reel-video-generator';

const execFileAsync = promisify(execFile);

export interface ViralVideoCandidate {
  videoId: string;
  url: string;
  rawTitle: string;
  cleanTitle: string;
  editorialSummary: string;
  channelName: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
  uploadDate: string; // YYYYMMDD
  thumbnailUrl?: string;
  viralScore: number;
  category: string;
}

const CURATED_TRABZONSPOR_SHORTS_SOURCES = [
  'https://www.youtube.com/@61saattv/shorts',
  'https://www.youtube.com/@Trabzonspor/shorts',
  'https://www.youtube.com/@trabzonspor61tv/shorts',
  'https://www.youtube.com/@Haber61TV/shorts',
  'https://www.youtube.com/@KuzeyEkspresGazetesi/shorts',
];

const VIRAL_SEARCH_QUERIES = [
  'ytsearch12:trabzonspor #shorts',
  'ytsearch10:trabzonspor taraftar #shorts',
  'ytsearch10:trabzonspor gol #shorts',
];

const RIVAL_BLACKLIST_PATTERNS = [
  /#gs\b/i,
  /#gstv\b/i,
  /#galatasaray/i,
  /#cimbom/i,
  /#ultraslan/i,
  /\bicardi\b/i,
  /\bosimhen\b/i,
  /#fb\b/i,
  /#fenerbah[cç]e/i,
  /\bmourinho\b/i,
  /\bdzeko\b/i,
  /\btadic\b/i,
  /#bjk\b/i,
  /#be[sş]ikta[sş]/i,
  /#kartal/i,
  /\btalisca\b/i,
  /\bimmobile\b/i,
  /\brafa\s*silva\b/i,
  /\bgalatasaray\s*kazand[ıi]/i,
  /\bfenerbah[cç]e\s*kazand[ıi]/i,
  /\bbe[sş]ikta[sş]\s*kazand[ıi]/i,
];

const TRABZONSPOR_POSITIVE_PATTERNS = [
  /trabzonspor/i,
  /bordo\s*mavi/i,
  /karadeniz\s*f[ıi]rt[ıi]nas[ıi]/i,
  /papara\s*park/i,
  /avni\s*aker/i,
  /[sş]enol\s*g[üu]ne[sş]/i,
  /fatih\s*tekke/i,
  /ertuğrul\s*do[ğg]an/i,
  /u[ğg]urcan\s*[cç]ak[ıi]r/i,
  /\bbanza\b/i,
  /\bzubkov\b/i,
  /\bcham\b/i,
  /\bnwakaeme\b/i,
  /\bvisca\b/i,
  /\bdragu[sş]\b/i,
  /\bmendy\b/i,
  /\bokay\s*yoku[sş]lu\b/i,
  /\beren\s*elmal[ıi]\b/i,
  /\bmalheiro\b/i,
  /\bsikan\b/i,
  /\bbatagov\b/i,
];

const NON_SPORTS_CITY_PATTERNS = [
  /\bbakanl[ıi]k\b/i,
  /\bbelediye\b/i,
  /\bmahallesi\b/i,
  /\bkentsel\s*d[öo]n[üu][sş][üu]m\b/i,
  /\btrafik\s*kazas[ıi]\b/i,
  /\bhava\s*durumu\b/i,
  /\bf[ıi]nd[ıi]k\s*fiyat/i,
  /\b[cç]aykur\b/i,
];

let cachedYtDlpPath: string | null = null;

/**
 * yt-dlp çalıştırılabilir dosya yolunu bulur; Linux sunucuda yoksa otomatik indirir.
 */
export async function getYtDlpPath(): Promise<string> {
  if (cachedYtDlpPath && fs.existsSync(cachedYtDlpPath)) {
    return cachedYtDlpPath;
  }

  const candidates = [
    process.env.YTDLP_PATH,
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(os.tmpdir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
  ].filter(Boolean) as string[];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    candidates.push(
      path.join(localAppData, 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe')
    );
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0 && fs.existsSync(candidate)) {
      cachedYtDlpPath = candidate;
      return candidate;
    }
  }

  // PATH üzerinde yt-dlp kontrolü
  try {
    await execFileAsync('yt-dlp', ['--version'], { timeout: 5000 });
    cachedYtDlpPath = 'yt-dlp';
    return 'yt-dlp';
  } catch {}

  // Otomatik self-healing: yt-dlp binary'sini GitHub Releases'tan os.tmpdir() içine indir
  const targetBin = path.join(os.tmpdir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  const downloadUrl =
    process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

  console.log(`[ViralDiscoverer] ⬇️ Downloading yt-dlp binary from ${downloadUrl}...`);
  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) {
    throw new Error(`yt-dlp indirilemedi: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(targetBin, buf);
  if (process.platform !== 'win32') {
    fs.chmodSync(targetBin, 0o755);
  }
  cachedYtDlpPath = targetBin;
  return targetBin;
}

/**
 * Üçüncü parti sayfa isimlerini, hashtag'leri, mention'ları ve reklam ibarelerini başlıktan temizler.
 */
export function sanitizeViralTitle(rawTitle: string): string {
  if (!rawTitle) return 'TRABZONSPOR GÜNDEMİNİ SARSAN O ANLAR!';

  // 1. Matematiksel bold/italic Unicode karakterleri standart harflere dönüştür (örn: 𝐌𝐞𝐥𝐢𝐡 -> Melih)
  let cleaned = rawTitle.normalize('NFKC');

  cleaned = cleaned
    // Hashtag ve @mention temizliği
    .replace(/#[\wığüşöçİĞÜŞÖÇ0-9_]+/gi, ' ')
    .replace(/@[\wığüşöçİĞÜŞÖÇ0-9_.]+/gi, ' ')
    // Emoji ve sembol temizliği (SVG manşette kırık ikon çıkmaması için)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, ' ')
    // Bilinen dış sayfa/kanal isimleri temizliği
    .replace(/\b(61\s*saat\s*tv|61\s*saat|haber\s*61|kuzey\s*ekspres|61\s*tv|trabzonspor\s*61\s*tv|shorts|reels|tiktok|keşfet|kesfet|fyp|viral)\b/gi, ' ')
    // Sonda veya başta kalan dikey çizgi, tire, parantez içi kanal adları
    .replace(/\[\s*\]|\(\s*\)/g, ' ')
    .replace(/\s+[-|•:/]+\s*$/g, '')
    .replace(/^\s*[-|•:/]+\s+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // İngilizce tek cümlelik başlıkları Türkçe Bordo-Mavi manşete çevir
  if (/\b(he was|now he|scoring|what a goal|matchday|training)\b/i.test(cleaned)) {
    cleaned = 'TRABZONSPOR SAHADA FIRTINA GİBİ ESİYOR: MUHTEŞEM GOL!';
  }

  // Çok kısa (örn: "Usta işi bitiriş") başlıklara güçlü Trabzonspor bağlamı ekle
  if (cleaned.length >= 4 && cleaned.length < 24 && !/trabzonspor|bordo\s*mavi|fırtına/i.test(cleaned)) {
    cleaned = `TRABZONSPOR'DAN ${cleaned.toLocaleUpperCase('tr-TR')}!`;
  } else if (cleaned.length < 10) {
    cleaned = 'TRABZONSPOR TARAFTARINDAN SOSYAL MEDYAYI SALLAYAN GÖRÜNTÜLER!';
  }

  return cleaned;
}

/**
 * Temizlenen başlıktan güçlü, özgün ve etkileşim odaklı editöryel özet ve kategori üretir.
 */
export function buildViralEditorialContext(cleanTitle: string, rawDescription?: string): {
  summary: string;
  category: string;
} {
  const text = `${cleanTitle} ${rawDescription || ''}`.toLocaleLowerCase('tr-TR');

  let category = 'Viral Gündem';
  if (/(transfer|imza|kadro|anla[sş]ma|teklif)/i.test(text)) {
    category = 'Transfer';
  } else if (/(gol|[sş]ut|asist|bitiri[sş]|kurtar[ıi][sş]|ate[sş]ledi|ma[cç]|skor|galibiyet|antrenman|idman)/i.test(text)) {
    category = 'Maç & Saha İçi';
  } else if (/(taraftar|trib[üu]n|sevda|horon|kolbast[ıi]|forma|co[sş]ku|papara|mira[cç])/i.test(text)) {
    category = 'Taraftar & Tribün';
  }

  // Üçüncü parti açıklamaları kopyalamak yerine kendi özgün Bordo-Mavi editöryel metnimizi kuruyoruz
  let summary = '';
  if (category === 'Taraftar & Tribün') {
    summary = `${cleanTitle}. Bordo-Mavili renklere gönül veren taraftarlarımızın tutkusunu ve Karadeniz fırtınasının büyüklüğünü bir kez daha gözler önüne seren bu görüntüler sosyal medyada binlerce etkileşim alarak gündeme damga vurdu.`;
  } else if (category === 'Maç & Saha İçi') {
    summary = `${cleanTitle}. Trabzonspor'umuzun sahadaki mücadelesi ve unutulmaz anları Bordo-Mavi camiada büyük heyecan yarattı. Sosyal medyada en çok konuşulan o anları sizler için derledik.`;
  } else if (category === 'Transfer') {
    summary = `${cleanTitle}. Bordo-Mavili kulübümüzün gündemindeki bu sıcak gelişme taraftarlar arasında büyük heyecan uyandırdı.`;
  } else {
    summary = `${cleanTitle}. Trabzonspor gündeminde sosyal medyada hızla yayılan ve taraftarlarımızın yoğun ilgi gösterdiği o özel anlar büyük beğeni topladı.`;
  }

  return { summary, category };
}

/**
 * Daha önce paylaşılmış viral video ID listesini getirir.
 */
export async function getPublishedViralVideoIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'PUBLISHED_VIRAL_VIDEOS' },
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') ids.add(item);
          else if (item?.videoId) ids.add(String(item.videoId));
        }
      }
    }
  } catch (e: any) {
    console.warn('[ViralDiscoverer] Could not read PUBLISHED_VIRAL_VIDEOS setting:', e.message);
  }
  return ids;
}

/**
 * Paylaşılan viral videoyu veritabanına kaydeder (tekrar paylaşılmaması için).
 */
export async function markViralVideoAsPublished(entry: {
  videoId: string;
  url: string;
  title: string;
  facebookPostId?: string;
}): Promise<void> {
  try {
    const existing = await prisma.setting.findUnique({
      where: { key: 'PUBLISHED_VIRAL_VIDEOS' },
    });
    let list: any[] = [];
    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value);
        if (Array.isArray(parsed)) list = parsed;
      } catch {}
    }

    list.unshift({
      ...entry,
      publishedAt: new Date().toISOString(),
    });
    // Son 200 viral videoyu sakla
    list = list.slice(0, 200);

    await prisma.setting.upsert({
      where: { key: 'PUBLISHED_VIRAL_VIDEOS' },
      update: { value: JSON.stringify(list) },
      create: { key: 'PUBLISHED_VIRAL_VIDEOS', value: JSON.stringify(list) },
    });
  } catch (e: any) {
    console.warn('[ViralDiscoverer] Failed to mark viral video as published:', e.message);
  }
}

/**
 * Videonun Trabzonspor dostu olup olmadığını ve rakip/negatif içerik barındırmadığını denetler.
 */
export function isValidTrabzonsporViralCandidate(title: string, description: string, channelName: string): boolean {
  const combined = `${title} ${description} ${channelName}`;
  const textOnly = `${title} ${description}`;

  // 1. Rakip kara liste kontrolü (Icardi, GS, FB, BJK vb. videoları kesinlikle reddet)
  for (const rivalPattern of RIVAL_BLACKLIST_PATTERNS) {
    if (rivalPattern.test(combined)) {
      return false;
    }
  }

  // 2. Spor dışı yerel belediye/şehir haberlerini ele
  for (const cityPattern of NON_SPORTS_CITY_PATTERNS) {
    if (cityPattern.test(textOnly)) {
      return false;
    }
  }

  // 3. Resmi Trabzonspor kanalıysa veya başlık/açıklamada Trabzonspor ibaresi geçiyorsa kabul et
  const isDedicatedTsChannel = /(@trabzonspor\b|trabzonspor\s*61)/i.test(channelName);
  const hasTrabzonsporKeyword = TRABZONSPOR_POSITIVE_PATTERNS.some((pattern) => pattern.test(textOnly));
  if (!isDedicatedTsChannel && !hasTrabzonsporKeyword) {
    return false;
  }

  return true;
}

/**
 * Tekil bir video URL'sinin tam metaverisini yt-dlp ile çeker ve viral skorunu hesaplar.
 */
export async function inspectViralVideoUrl(url: string): Promise<ViralVideoCandidate | null> {
  const ytdlp = await getYtDlpPath();
  const ffmpegPath = getFFmpegPath();

  try {
    const { stdout } = await execFileAsync(
      ytdlp,
      [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--ffmpeg-location',
        ffmpegPath,
        '--extractor-args',
        'youtube:lang=tr',
        url,
      ],
      { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }
    );

    const data = JSON.parse(stdout.trim().split('\n')[0]);
    const videoId = String(data.id || '');
    const rawTitle = String(data.title || '');
    const description = String(data.description || '');
    const channelName = String(data.channel || data.uploader || '');
    const durationSeconds = Number(data.duration || 0);
    const viewCount = Number(data.view_count || 0);
    const likeCount = Number(data.like_count || 0);
    const commentCount = Number(data.comment_count || 0);
    const uploadDate = String(data.upload_date || '');
    const webpageUrl = String(data.webpage_url || url);
    const thumbnailUrl = String(data.thumbnail || '');

    if (!videoId || durationSeconds < 10 || durationSeconds > 120) {
      return null;
    }

    const cleanTitle = sanitizeViralTitle(rawTitle);
    const { summary, category } = buildViralEditorialContext(cleanTitle, description);

    // Viral skor hesaplama (İzlenme + Beğeni*30 + Yorum*60 + Güncellik Çarpanı)
    let recencyMultiplier = 1.0;
    if (uploadDate && uploadDate.length === 8) {
      const y = Number(uploadDate.slice(0, 4));
      const m = Number(uploadDate.slice(4, 6)) - 1;
      const d = Number(uploadDate.slice(6, 8));
      const uploadedAt = new Date(y, m, d).getTime();
      const ageDays = Math.max(0, (Date.now() - uploadedAt) / (1000 * 60 * 60 * 24));

      if (ageDays <= 2) recencyMultiplier = 4.0;
      else if (ageDays <= 5) recencyMultiplier = 2.8;
      else if (ageDays <= 14) recencyMultiplier = 1.8;
      else if (ageDays <= 30) recencyMultiplier = 1.3;
      else if (ageDays > 180) recencyMultiplier = 0.4;
    }

    // Sokak röportajı mikrofonu içermeyen saf saha içi / tribün / kulüp videolarına ekstra öncelik çarpanı
    const isMediaMicrophoneChannel = /(61\s*saat|haber\s*61|kuzey\s*ekspres)/i.test(channelName);
    const sourcePurityMultiplier = isMediaMicrophoneChannel ? 0.65 : 1.35;

    const rawEngagement = viewCount + likeCount * 30 + commentCount * 60;
    const viralScore = Math.round(rawEngagement * recencyMultiplier * sourcePurityMultiplier);

    return {
      videoId,
      url: webpageUrl,
      rawTitle,
      cleanTitle,
      editorialSummary: summary,
      channelName,
      viewCount,
      likeCount,
      commentCount,
      durationSeconds,
      uploadDate,
      thumbnailUrl,
      viralScore,
      category,
    };
  } catch (e: any) {
    console.warn(`[ViralDiscoverer] Could not inspect URL (${url}):`, e.message);
    return null;
  }
}

/**
 * İnterneti tarayarak Trabzonspor ile ilgili en trend/viral dikey videoları keşfeder,
 * rakip ve daha önce paylaşılan videoları eler ve viral skora göre sıralar.
 */
export async function discoverTrendingTrabzonsporVideos(options?: {
  limit?: number;
  includePublished?: boolean;
}): Promise<ViralVideoCandidate[]> {
  const limit = options?.limit || 8;
  const ytdlp = await getYtDlpPath();
  const publishedIds = options?.includePublished ? new Set<string>() : await getPublishedViralVideoIds();

  console.log('[ViralDiscoverer] 🔍 Scanning internet for viral Trabzonspor Reels/Shorts...');

  // 1. Hızlı flat-playlist taraması ile aday video ID'lerini topla
  const rawEntries: { id: string; title: string; url: string; source: string }[] = [];
  const seenIds = new Set<string>();

  const scanSource = async (sourceOrQuery: string, playlistEnd: number) => {
    try {
      const { stdout } = await execFileAsync(
        ytdlp,
        [
          '--flat-playlist',
          '--dump-json',
          '--playlist-end',
          String(playlistEnd),
          '--no-warnings',
          '--extractor-args',
          'youtube:lang=tr',
          sourceOrQuery,
        ],
        { timeout: 22000, maxBuffer: 8 * 1024 * 1024 }
      );

      const lines = stdout
        .trim()
        .split('\n')
        .filter((l) => l.trim().startsWith('{'));

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const id = String(item.id || '');
          const title = String(item.title || '');
          if (!id || seenIds.has(id) || publishedIds.has(id)) continue;

          // Ön filtreleme: Rakip içerikleri hemen ele
          if (!isValidTrabzonsporViralCandidate(title, '', sourceOrQuery)) {
            continue;
          }

          seenIds.add(id);
          rawEntries.push({
            id,
            title,
            url: item.url || `https://www.youtube.com/shorts/${id}`,
            source: sourceOrQuery,
          });
        } catch {}
      }
    } catch (e: any) {
      console.warn(`[ViralDiscoverer] Source scan warning (${sourceOrQuery}):`, e.message);
    }
  };

  // Paralel olarak Trabzonspor kaynaklarını ve genel viral aramaları tara
  await Promise.all([
    ...CURATED_TRABZONSPOR_SHORTS_SOURCES.map((src) => scanSource(src, 5)),
    ...VIRAL_SEARCH_QUERIES.map((q) => scanSource(q, 8)),
  ]);

  console.log(`[ViralDiscoverer] Found ${rawEntries.length} unique candidate Shorts after pre-filtering.`);

  // En güçlü ilk 10 adayın gerçek izlenme/beğeni/tarih detaylarını paralel (4'erli gruplar halinde) çek
  const topToInspect = rawEntries.slice(0, 10);
  const detailedCandidates: ViralVideoCandidate[] = [];

  const batchSize = 4;
  for (let i = 0; i < topToInspect.length; i += batchSize) {
    const batch = topToInspect.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((entry) => inspectViralVideoUrl(entry.url)));

    for (const candidate of results) {
      if (!candidate) continue;
      if (!options?.includePublished && publishedIds.has(candidate.videoId)) continue;
      if (!isValidTrabzonsporViralCandidate(candidate.rawTitle, candidate.editorialSummary, candidate.channelName)) {
        continue;
      }
      detailedCandidates.push(candidate);
    }
  }

  // Viral skora göre büyükten küçüğe sırala
  detailedCandidates.sort((a, b) => b.viralScore - a.viralScore);

  console.log(
    `[ViralDiscoverer] ✅ Ranked ${detailedCandidates.length} verified Trabzonspor viral videos. Top=${
      detailedCandidates[0]
        ? `"${detailedCandidates[0].cleanTitle}" (Views: ${detailedCandidates[0].viewCount}, Likes: ${detailedCandidates[0].likeCount}, Score: ${detailedCandidates[0].viralScore})`
        : 'NONE'
    }`
  );

  return detailedCandidates.slice(0, limit);
}
