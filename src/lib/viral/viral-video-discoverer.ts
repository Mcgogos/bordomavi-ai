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

const TRABZON_REGION_SEARCH_QUERIES = [
  'ytsearch15:trabzon horon kemençe #shorts',
  'ytsearch15:trabzon uzungöl sümela yayla #shorts',
  'ytsearch12:trabzon karadeniz yöresel #shorts',
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
  /\brizesporlu\b/i,
];

const TRABZONSPOR_POSITIVE_PATTERNS = [
  /trabzonspor/i,
  /trabzon\s*taraftar/i,
  /\b[üu]nits\b/i,
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

const TRABZON_REGION_POSITIVE_PATTERNS = [
  /\btrabzon/i,
  /\buzung[öo]l/i,
  /\bs[üu]mela/i,
  /\bhoron\b/i,
  /\bkemen[cç]e\b/i,
  /\byayla/i,
  /\bak[cç]aabat/i,
  /\bma[cç]ka\b/i,
  /\b[cç]aykara\b/i,
  /\bs[üu]rmene\b/i,
  /\bvakf[ıi]kebir\b/i,
  /\btonya\b/i,
  /\bboztepe\b/i,
  /\bh[ıi]d[ıi]rnebi\b/i,
  /\bkuymak\b/i,
  /\bm[ıi]hlama\b/i,
  /\bkolbast[ıi]\b/i,
  /\bkaradeniz\b/i,
];

const NEGATIVE_POLITICS_CRIME_PATTERNS = [
  /\bbakanl[ıi]k\b/i,
  /\bbelediye\b/i,
  /\bkentsel\s*d[öo]n[üu][sş][üu]m\b/i,
  /\btrafik\s*kazas[ıi]\b/i,
  /\bcinayet\b/i,
  /\bg[öo]zalt[ıi]\b/i,
  /\basgari\s*[üu]cret\b/i,
  /\bsiyaset\b/i,
  /\bse[cç]im\b/i,
  /\botel\b/i,
  /\bresort\b/i,
  /\bsen\s*anlat\s*karadeniz\b/i,
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
export function sanitizeViralTitle(rawTitle: string, isTrabzonRegion = false): string {
  if (!rawTitle) {
    return isTrabzonRegion
      ? 'TRABZON YÖRESİNDEN SOSYAL MEDYAYI SALLAYAN GÖRÜNTÜLER!'
      : 'TRABZONSPOR GÜNDEMİNİ SARSAN O ANLAR!';
  }

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
  } else if (/\b(best places to visit|black sea region)\b/i.test(cleaned)) {
    cleaned = 'TRABZON YÖRESİNDEN EŞSİZ KARADENİZ VE UZUNGÖL MANZARALARI!';
  }

  if (isTrabzonRegion) {
    if (cleaned.length >= 4 && cleaned.length < 32 && !/trabzon|karadeniz|uzungöl|sümela/i.test(cleaned)) {
      cleaned = `TRABZON YÖRESİNDEN: ${cleaned.toLocaleUpperCase('tr-TR')}!`;
    } else if (cleaned.length < 10) {
      cleaned = 'TRABZON YÖRESİNDEN SOSYAL MEDYAYI SALLAYAN GÖRÜNTÜLER!';
    }
    return cleaned;
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
export function buildViralEditorialContext(
  cleanTitle: string,
  rawDescription?: string,
  forceCategory?: string
): {
  summary: string;
  category: string;
} {
  const text = `${cleanTitle} ${rawDescription || ''}`.toLocaleLowerCase('tr-TR');

  let category = forceCategory || 'Viral Gündem';
  if (!forceCategory) {
    if (/(transfer|imza|kadro|anla[sş]ma|teklif)/i.test(text)) {
      category = 'Transfer';
    } else if (/(gol|[sş]ut|asist|bitiri[sş]|kurtar[ıi][sş]|ate[sş]ledi|ma[cç]|skor|galibiyet|antrenman|idman)/i.test(text)) {
      category = 'Maç & Saha İçi';
    } else if (/(taraftar|trib[üu]n|sevda|forma|co[sş]ku|papara|mira[cç])/i.test(text)) {
      category = 'Taraftar & Tribün';
    }
  }

  let summary = '';
  if (category === 'Trabzon Yöresi') {
    summary = `${cleanTitle}. Trabzon yöremizin eşsiz kültürünü, yaylalarını, horon coşkusunu ve Karadeniz insanımızın samimiyetini yansıtan bu görüntüler sosyal medyada günün en çok izlenen viral videoları arasına girdi.`;
  } else if (category === 'Taraftar & Tribün') {
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
 * Videonun Trabzonspor veya Trabzon Yöresi viral adayı olup olmadığını sınıflandırır.
 * Rakip veya negatif/siyasi/asayiş içerikleri kesinlikle reddeder.
 */
export function classifyViralCandidate(
  title: string,
  description: string,
  channelName: string
): 'TRABZONSPOR' | 'TRABZON_YORESI' | null {
  const combined = `${title} ${description} ${channelName}`;
  const textOnly = `${title} ${description}`;

  // 1. Rakip kara liste kontrolü (Icardi, GS, FB, BJK vb. videoları kesinlikle reddet)
  for (const rivalPattern of RIVAL_BLACKLIST_PATTERNS) {
    if (rivalPattern.test(combined)) {
      return null;
    }
  }

  // 2. Siyaset, kaza, cinayet, otel reklamı gibi uygunsuz içerikleri ele
  for (const negPattern of NEGATIVE_POLITICS_CRIME_PATTERNS) {
    if (negPattern.test(textOnly)) {
      return null;
    }
  }

  // 3. Trabzonspor kontrolü
  const isDedicatedTsChannel = /(@trabzonspor\b|trabzonspor\s*61)/i.test(channelName);
  const hasTrabzonsporKeyword = TRABZONSPOR_POSITIVE_PATTERNS.some((pattern) => pattern.test(textOnly));
  if (isDedicatedTsChannel || hasTrabzonsporKeyword) {
    return 'TRABZONSPOR';
  }

  // 4. Trabzon Yöresi (Horon, Kemençe, Uzungöl, Sümela, Yayla, Karadeniz kültürü) kontrolü
  const hasTrabzonRegionKeyword = TRABZON_REGION_POSITIVE_PATTERNS.some((pattern) => pattern.test(textOnly));
  if (hasTrabzonRegionKeyword) {
    return 'TRABZON_YORESI';
  }

  return null;
}

export function isValidTrabzonsporViralCandidate(title: string, description: string, channelName: string): boolean {
  return classifyViralCandidate(title, description, channelName) !== null;
}

/**
 * Tekil bir video URL'sinin tam metaverisini yt-dlp ile çeker ve viral skorunu hesaplar.
 */
export async function inspectViralVideoUrl(
  url: string,
  hintTheme?: 'TRABZONSPOR' | 'TRABZON_YORESI'
): Promise<ViralVideoCandidate | null> {
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
        '--add-header',
        'Accept-Language:tr-TR,tr;q=0.9',
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

    const detectedTheme = classifyViralCandidate(rawTitle, description, channelName) || hintTheme;
    if (!detectedTheme) {
      return null;
    }

    const isRegionVideo = detectedTheme === 'TRABZON_YORESI';
    const cleanTitle = sanitizeViralTitle(rawTitle, isRegionVideo);
    const { summary, category } = buildViralEditorialContext(
      cleanTitle,
      description,
      isRegionVideo ? 'Trabzon Yöresi' : undefined
    );

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
 * İnterneti tarayarak hem Trabzonspor hem de Trabzon Yöresine ait en trend/viral dikey videoları keşfeder,
 * rakip ve daha önce paylaşılan videoları eler ve viral skora göre sıralar.
 */
export async function discoverTrendingTrabzonsporVideos(options?: {
  limit?: number;
  includePublished?: boolean;
  preferCategory?: 'Trabzon Yöresi' | 'Trabzonspor';
}): Promise<ViralVideoCandidate[]> {
  const limit = options?.limit || 8;
  const ytdlp = await getYtDlpPath();
  const publishedIds = options?.includePublished ? new Set<string>() : await getPublishedViralVideoIds();

  console.log('[ViralDiscoverer] 🔍 Scanning internet for viral Trabzonspor & Trabzon Region Reels/Shorts...');

  const tsEntries: { id: string; title: string; url: string; viewCount: number }[] = [];
  const regionEntries: { id: string; title: string; url: string; viewCount: number }[] = [];
  const seenIds = new Set<string>();

  const scanSource = async (
    sourceOrQuery: string,
    playlistEnd: number,
    defaultTheme?: 'TRABZONSPOR' | 'TRABZON_YORESI'
  ) => {
    try {
      const { stdout } = await execFileAsync(
        ytdlp,
        [
          '--flat-playlist',
          '--dump-json',
          '--playlist-end',
          String(playlistEnd),
          '--no-warnings',
          '--add-header',
          'Accept-Language:tr-TR,tr;q=0.9',
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
          const duration = Number(item.duration || 0);
          const viewCount = Number(item.view_count || 0);

          if (!id || seenIds.has(id) || publishedIds.has(id)) continue;
          // Eğer flat-playlist süreyi veriyorsa 10-95 sn dışındakileri baştan ele
          if (duration > 0 && (duration < 10 || duration > 95)) continue;

          const theme = classifyViralCandidate(title, '', sourceOrQuery) || defaultTheme;
          if (!theme) continue;

          seenIds.add(id);
          const entry = {
            id,
            title,
            url: item.url || `https://www.youtube.com/shorts/${id}`,
            viewCount,
          };

          if (theme === 'TRABZON_YORESI') {
            regionEntries.push(entry);
          } else {
            tsEntries.push(entry);
          }
        } catch {}
      }
    } catch (e: any) {
      console.warn(`[ViralDiscoverer] Source scan warning (${sourceOrQuery}):`, e.message);
    }
  };

  // Paralel olarak Trabzonspor kaynaklarını ve Trabzon Yöresi viral aramalarını tara
  await Promise.all([
    ...CURATED_TRABZONSPOR_SHORTS_SOURCES.map((src) => scanSource(src, 6)),
    ...VIRAL_SEARCH_QUERIES.map((q) => scanSource(q, 8, 'TRABZONSPOR')),
    ...TRABZON_REGION_SEARCH_QUERIES.map((q) => scanSource(q, 14, 'TRABZON_YORESI')),
  ]);

  // Flat-playlist izlenme sayısına göre ön sıralama yap
  tsEntries.sort((a, b) => b.viewCount - a.viewCount);
  regionEntries.sort((a, b) => b.viewCount - a.viewCount);

  console.log(
    `[ViralDiscoverer] Found ${tsEntries.length} Trabzonspor candidates and ${regionEntries.length} Trabzon Region candidates.`
  );

  // En güçlü 8 Trabzonspor adayını ve en güçlü 4 Trabzon Yöresi adayını paralel incele
  const topToInspect: { url: string; theme: 'TRABZONSPOR' | 'TRABZON_YORESI' }[] = [
    ...tsEntries.slice(0, 8).map((e) => ({ url: e.url, theme: 'TRABZONSPOR' as const })),
    ...regionEntries.slice(0, 4).map((e) => ({ url: e.url, theme: 'TRABZON_YORESI' as const })),
  ];

  const detailedTs: ViralVideoCandidate[] = [];
  const detailedRegion: ViralVideoCandidate[] = [];

  const batchSize = 4;
  for (let i = 0; i < topToInspect.length; i += batchSize) {
    const batch = topToInspect.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((entry) => inspectViralVideoUrl(entry.url, entry.theme)));

    for (const candidate of results) {
      if (!candidate) continue;
      if (!options?.includePublished && publishedIds.has(candidate.videoId)) continue;
      if (candidate.category === 'Trabzon Yöresi') {
        detailedRegion.push(candidate);
      } else {
        detailedTs.push(candidate);
      }
    }
  }

  detailedTs.sort((a, b) => b.viralScore - a.viralScore);
  detailedRegion.sort((a, b) => b.viralScore - a.viralScore);

  // Nihai listeyi oluştur: En trend Trabzonspor videoları + Günün En Viral Trabzon Yöresi Videoları
  const detailedCandidates: ViralVideoCandidate[] = [];
  if (options?.preferCategory === 'Trabzon Yöresi') {
    detailedCandidates.push(...detailedRegion, ...detailedTs);
  } else {
    // 1. sırada en viral Trabzonspor videosu, 2. sırada Günün En Viral Trabzon Yöresi videosu, ardından diğerleri
    if (detailedTs.length > 0) detailedCandidates.push(detailedTs[0]);
    if (detailedRegion.length > 0) detailedCandidates.push(detailedRegion[0]);
    detailedCandidates.push(...detailedTs.slice(1, 6));
    if (detailedRegion.length > 1) detailedCandidates.push(...detailedRegion.slice(1, 3));
  }

  // Eğer sunucusuz (Netlify/Vercel) ortamda yt-dlp çalışmadıysa saf HTTP YouTube Shorts tarayıcısına geç
  if (detailedCandidates.length === 0) {
    const webFallback = await discoverTrendingViaYouTubeWeb(publishedIds);
    detailedCandidates.push(...webFallback);
  }

  if (detailedCandidates.length > 0) {
    await saveDailyTrendingVideos(detailedCandidates.slice(0, 8));
  } else {
    const cached = await getCachedDailyTrendingVideos();
    if (cached.items.length > 0) {
      detailedCandidates.push(...cached.items);
    }
  }

  console.log(
    `[ViralDiscoverer] ✅ Ranked ${detailedCandidates.length} verified Trabzonspor viral videos. Top=${
      detailedCandidates[0]
        ? `"${detailedCandidates[0].cleanTitle}" (Views: ${detailedCandidates[0].viewCount}, Likes: ${detailedCandidates[0].likeCount}, Score: ${detailedCandidates[0].viralScore})`
        : 'NONE'
    }`
  );

  return detailedCandidates.slice(0, limit);
}

/**
 * Günlük belirlenen en trend videoları veritabanına önbellekler (Web arayüzünde anında açılması için).
 */
export async function saveDailyTrendingVideos(candidates: ViralVideoCandidate[]): Promise<void> {
  try {
    const payload = {
      updatedAt: new Date().toISOString(),
      items: candidates,
    };
    await prisma.setting.upsert({
      where: { key: 'DAILY_TRENDING_VIDEOS' },
      update: { value: JSON.stringify(payload) },
      create: { key: 'DAILY_TRENDING_VIDEOS', value: JSON.stringify(payload) },
    });
  } catch (e: any) {
    console.warn('[ViralDiscoverer] Could not save DAILY_TRENDING_VIDEOS:', e.message);
  }
}

/**
 * Veritabanında kayıtlı günlük en trend Trabzonspor videolarını getirir.
 */
export async function getCachedDailyTrendingVideos(): Promise<{
  updatedAt: string | null;
  items: ViralVideoCandidate[];
}> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'DAILY_TRENDING_VIDEOS' },
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed?.items)) {
        return {
          updatedAt: parsed.updatedAt || setting.updatedAt.toISOString(),
          items: parsed.items,
        };
      }
    }
  } catch {}
  return { updatedAt: null, items: [] };
}

/**
 * Netlify / Vercel gibi binary kısıtlı serverless ortamlarda bile %100 çalışan saf HTTP YouTube Shorts keşif motoru.
 */
export async function discoverTrendingViaYouTubeWeb(publishedIds: Set<string>): Promise<ViralVideoCandidate[]> {
  const results: ViralVideoCandidate[] = [];
  const seen = new Set<string>();
  const urls = [
    'https://www.youtube.com/@Trabzonspor/shorts',
    'https://www.youtube.com/@61saattv/shorts',
    'https://www.youtube.com/results?search_query=trabzonspor+%23shorts&sp=CAMSAggB',
  ];

  for (const pageUrl of urls) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const regex = /"reelItemRenderer":\{"headline":\{"simpleText":"([^"]+)"\}.*?"videoId":"([a-zA-Z0-9_-]{11})".*?"viewCountText":\{"simpleText":"([^"]+)"\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const rawTitle = match[1];
        const videoId = match[2];
        const viewText = match[3] || '';
        if (!videoId || seen.has(videoId) || publishedIds.has(videoId)) continue;
        if (!isValidTrabzonsporViralCandidate(rawTitle, '', pageUrl)) continue;

        seen.add(videoId);
        const numMatch = viewText.replace(/\./g, '').match(/(\d+(?:,\d+)?)/);
        let views = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 15000;
        if (/B\b|bin/i.test(viewText)) views *= 1000;
        else if (/Mn|M\b/i.test(viewText)) views *= 1000000;
        views = Math.round(views);

        const cleanTitle = sanitizeViralTitle(rawTitle);
        const { summary, category } = buildViralEditorialContext(cleanTitle);

        results.push({
          videoId,
          url: `https://www.youtube.com/shorts/${videoId}`,
          rawTitle,
          cleanTitle,
          editorialSummary: summary,
          channelName: pageUrl.includes('@Trabzonspor') ? 'Trabzonspor' : 'Trabzonspor Gündem',
          viewCount: views,
          likeCount: Math.round(views * 0.045),
          commentCount: Math.round(views * 0.002),
          durationSeconds: 28,
          uploadDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hq720_2.jpg`,
          viralScore: Math.round(views * 2.5),
          category,
        });
      }
    } catch {}
  }

  results.sort((a, b) => b.viralScore - a.viralScore);
  return results.slice(0, 8);
}
