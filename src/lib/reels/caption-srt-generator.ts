import { SubtitleCue } from './reels-audio-synthesizer';

function formatSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);

  const hh = String(hrs).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(Math.min(999, ms)).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Verilen başlık, özet ve etkileşim sorusundan video süresine tam yayılmış
 * senkronize altyazı dilimleri (SubtitleCue[]) üretir.
 */
export function buildSubtitleCuesFromText(
  cleanTitle: string,
  editorialSummary: string,
  totalDurationSeconds: number,
  pollQuestion?: string
): SubtitleCue[] {
  const safeDuration = Math.max(6, totalDurationSeconds);
  const rawSegments: string[] = [];

  const titleClean = (cleanTitle || '').replace(/\s+/g, ' ').trim();
  if (titleClean) {
    rawSegments.push(titleClean);
  }

  const summarySentences = (editorialSummary || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  for (const sentence of summarySentences) {
    if (sentence.length <= 72) {
      rawSegments.push(sentence);
    } else {
      // Uzun cümleleri okunabilir 2 parçaya böl
      const words = sentence.split(' ');
      const mid = Math.ceil(words.length / 2);
      const part1 = words.slice(0, mid).join(' ').trim();
      const part2 = words.slice(mid).join(' ').trim();
      if (part1) rawSegments.push(part1);
      if (part2) rawSegments.push(part2);
    }
  }

  const questionClean = (pollQuestion || '').replace(/\s+/g, ' ').trim();
  if (questionClean && !rawSegments.some((s) => s.toLowerCase() === questionClean.toLowerCase())) {
    rawSegments.push(questionClean);
  }

  rawSegments.push('Trabzonspor gündemi için BordoMavi sayfamızı takip edin!');

  // Hedef dilim sayısı: her dilim yaklaşık 2.6 - 3.4 saniye sürsün
  const maxCues = Math.max(3, Math.min(10, Math.round(safeDuration / 3.0)));
  const selectedSegments = rawSegments.slice(0, maxCues);

  const cueDuration = Number((safeDuration / selectedSegments.length).toFixed(2));
  const cues: SubtitleCue[] = [];

  for (let i = 0; i < selectedSegments.length; i++) {
    const startTime = Number((i * cueDuration).toFixed(2));
    const endTime =
      i === selectedSegments.length - 1
        ? Number(safeDuration.toFixed(2))
        : Number(((i + 1) * cueDuration).toFixed(2));
    cues.push({
      startTime,
      endTime,
      text: selectedSegments[i],
    });
  }

  return cues;
}

/**
 * SubtitleCue dizisinden Meta / Facebook Reels ve MP4 mov_text uyumlu
 * standart SubRip (.srt) kapalı açıklamalı altyazı dosyası üretir.
 */
export function buildSrtFromCues(cues: SubtitleCue[]): string {
  if (!cues || cues.length === 0) {
    return [
      '1',
      '00:00:00,000 --> 00:00:04,000',
      'Trabzonspor ve Bordo-Mavi gündeminin en sıcak gelişmeleri.',
      '',
      '2',
      '00:00:04,000 --> 00:00:08,000',
      'BordoMavi sayfamızı takip etmeyi ve yorum yapmayı unutmayın!',
      '',
    ].join('\n');
  }

  const blocks: string[] = [];
  let idx = 1;

  for (const cue of cues) {
    const text = (cue.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = formatSrtTimestamp(cue.startTime);
    const end = formatSrtTimestamp(Math.max(cue.startTime + 0.8, cue.endTime));

    // Satır uzunluğu 42 karakteri geçiyorsa 2 satıra dengeli böl
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const w of words) {
      if ((currentLine + ' ' + w).trim().length <= 42) {
        currentLine = (currentLine + ' ' + w).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) lines.push(currentLine);

    blocks.push(`${idx}\n${start} --> ${end}\n${lines.slice(0, 2).join('\n')}\n`);
    idx++;
  }

  return blocks.join('\n');
}

/**
 * Herhangi bir Reels açıklama metninden otomatik .srt kapalı açıklamalı altyazı üretir.
 */
export function buildSrtFromCaptionText(caption: string, durationSeconds: number = 15): string {
  const cleanLines = (caption || '')
    .split('\n')
    .map((l) =>
      l
        .replace(/#[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]+/g, '')
        .replace(/@[a-zA-Z0-9_.]+/g, '')
        .replace(/[🔴🔵🔥⚡💬👇📌✍️🔔❤️💙👉]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((l) => l.length > 6 && !l.toLowerCase().startsWith('topluluk'));

  const title = cleanLines[0] || 'Trabzonspor ve Bordo-Mavi Gündemi';
  const summary = cleanLines.slice(1, 4).join('. ') || 'Bordo-Mavi camiadan en sıcak gelişmeler ve son dakika detayları.';
  const cues = buildSubtitleCuesFromText(title, summary, durationSeconds);
  return buildSrtFromCues(cues);
}
