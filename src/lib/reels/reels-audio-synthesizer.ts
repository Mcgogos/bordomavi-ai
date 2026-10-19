import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

export interface SubtitleCue {
  text: string;
  startTime: number;
  endTime: number;
}

export interface SynthesizedAudioResult {
  audioPath: string;
  durationSeconds: number;
  buffer: Buffer;
  cues: SubtitleCue[];
}

interface BoundaryItem {
  text: string;
  start: number;
  end: number;
}

/**
 * FFmpeg yardımıyla bir ses dosyasının net süresini saniye cinsinden hesaplar.
 */
export async function getAudioDurationSeconds(audioFilePath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-i', audioFilePath]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', () => {
      // "Duration: 00:00:28.45"
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match) {
        const hours = parseFloat(match[1]);
        const minutes = parseFloat(match[2]);
        const seconds = parseFloat(match[3]);
        const total = hours * 3600 + minutes * 60 + seconds;
        resolve(+total.toFixed(2));
      } else {
        resolve(25.0); // Güvenli varsayılan
      }
    });
  });
}

/**
 * Microsoft Neural TTS sınırlarını (Word & Sentence Boundaries)
 * TV yayını kalitesinde, ekranda taşma yapmayan 1-2 satırlık akıcı altyazı dilimlerine dönüştürür.
 */
function buildCuesFromBoundaries(
  sentences: BoundaryItem[],
  words: BoundaryItem[],
  maxCueLength: number = 46
): SubtitleCue[] {
  if (!sentences || sentences.length === 0) {
    return [];
  }

  const cues: SubtitleCue[] = [];

  for (const s of sentences) {
    const text = s.text.trim();
    if (text.length <= maxCueLength || !words || words.length === 0) {
      cues.push({ text, startTime: s.start, endTime: s.end });
      continue;
    }

    // Bu cümlenin zaman aralığına denk gelen kelimeleri eşleştir
    const sWords = words.filter(w => w.start >= s.start - 0.15 && w.end <= s.end + 0.15);
    if (sWords.length <= 1) {
      cues.push({ text, startTime: s.start, endTime: s.end });
      continue;
    }

    let currentWords: BoundaryItem[] = [];
    let currentLength = 0;

    for (let i = 0; i < sWords.length; i++) {
      const w = sWords[i];
      const wordLen = w.text.length + 1;
      const isPunctuation = /[,;:]$/.test(w.text);

      // Uzunluk limitini aşıyorsa veya virgül/noktalı virgül ile mantıklı duraklama varsa böl
      if (currentWords.length > 0 && (currentLength + wordLen > maxCueLength || (isPunctuation && currentLength >= 20))) {
        currentWords.push(w);
        const chunkText = currentWords.map(x => x.text).join(' ');
        cues.push({
          text: chunkText,
          startTime: currentWords[0].start,
          endTime: currentWords[currentWords.length - 1].end
        });
        currentWords = [];
        currentLength = 0;
      } else {
        currentWords.push(w);
        currentLength += wordLen;
      }
    }

    if (currentWords.length > 0) {
      const chunkText = currentWords.map(x => x.text).join(' ');
      cues.push({
        text: chunkText,
        startTime: currentWords[0].start,
        endTime: currentWords[currentWords.length - 1].end
      });
    }
  }

  // Bitişik altyazı dilimleri arasında anlamsız milisaniyelik boşlukları yumuşat
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i + 1].startTime >= cues[i].endTime && cues[i + 1].startTime - cues[i].endTime < 0.35) {
      cues[i].endTime = cues[i + 1].startTime;
    }
  }

  return cues;
}

/**
 * Birincil Seslendirme Motoru:
 * Microsoft Azure / Edge Neural Türkçe Haber Spikeri (tr-TR-AhmetNeural).
 * Tamamen doğal, nefes ve tonlama içeren stüdyo kalitesinde insan sesi üretir.
 * Word/Sentence metadata ile milisaniyelik altyazı senkronizasyonu sağlar.
 */
async function synthesizeWithNeuralTTS(
  narrationText: string,
  finalAudioPath: string
): Promise<{ duration: number; buffer: Buffer; cues: SubtitleCue[] }> {
  const tts = new MsEdgeTTS();

  try {
    // tr-TR-AhmetNeural: Doğal Türkçe erkek haber spikeri tonu (TRT Spor / beIN Sports ayarında)
    await tts.setMetadata('tr-TR-AhmetNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
      sentenceBoundaryEnabled: true
    });

    const sentences: BoundaryItem[] = [];
    const words: BoundaryItem[] = [];

    // +16% hız: Doğal insan haber temposu (robotik ses germe algoritması olmadan, doğrudan neural model hızında)
    const { audioStream, metadataStream } = tts.toStream(narrationText, { rate: '+16%' });

    if (metadataStream) {
      metadataStream.on('data', (chunk) => {
        try {
          const obj = JSON.parse(chunk.toString());
          for (const item of (obj.Metadata || [])) {
            if (item.Type === 'SentenceBoundary' && item.Data?.text?.Text) {
              sentences.push({
                text: item.Data.text.Text,
                start: +(item.Data.Offset / 10000000).toFixed(2),
                end: +((item.Data.Offset + item.Data.Duration) / 10000000).toFixed(2)
              });
            } else if (item.Type === 'WordBoundary' && item.Data?.text?.Text) {
              words.push({
                text: item.Data.text.Text,
                start: +(item.Data.Offset / 10000000).toFixed(2),
                end: +((item.Data.Offset + item.Data.Duration) / 10000000).toFixed(2)
              });
            }
          }
        } catch {
          // Metadata ayrıştırma hatasını yut
        }
      });
    }

    const chunks: Buffer[] = [];
    audioStream.on('data', (d: Buffer) => chunks.push(d));

    await new Promise((resolve, reject) => {
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length < 1000) {
      throw new Error(`Neural TTS yetersiz ses verisi döndürdü (${audioBuffer.length} bayt).`);
    }

    fs.writeFileSync(finalAudioPath, audioBuffer);
    const duration = await getAudioDurationSeconds(finalAudioPath);

    const cues = buildCuesFromBoundaries(sentences, words, 46);
    if (cues.length > 0) {
      cues[cues.length - 1].endTime = Math.max(cues[cues.length - 1].endTime, duration);
    }

    return { duration, buffer: audioBuffer, cues };
  } finally {
    try {
      await tts.close();
    } catch {
      // Socket kapatma hatasını yut
    }
  }
}

/**
 * İkincil Yedek Motor (Google TTS Fail-Safe):
 * Ağ kesintisi veya rate limit durumunda sistemin asla durmaması için yedek ses üretir.
 */
async function synthesizeWithGoogleTTSFallback(
  narrationText: string,
  finalAudioPath: string
): Promise<{ duration: number; buffer: Buffer; cues: SubtitleCue[] }> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const chunkPaths: string[] = [];

  const sentences = narrationText.replace(/\s+/g, ' ').trim().split(/(?<=[.!?,;:])\s+/);
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).trim().length <= 70) {
      cur = (cur + ' ' + s).trim();
    } else {
      if (cur) chunks.push(cur);
      cur = s;
    }
  }
  if (cur) chunks.push(cur);

  for (let i = 0; i < chunks.length; i++) {
    const chunkFile = path.join(tempDir, `bm_tts_chunk_${timestamp}_${i}.mp3`);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunks[i])}&tl=tr&client=tw-ob`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 200) {
          fs.writeFileSync(chunkFile, buf);
          chunkPaths.push(chunkFile);
        }
      }
    } catch (e: any) {
      console.warn(`[AudioSynthesizer] Fallback chunk ${i} failed:`, e.message);
    }
  }

  if (chunkPaths.length === 0) {
    throw new Error("Yedek seslendirme motoru da başarısız oldu.");
  }

  const cues: SubtitleCue[] = [];
  let currentTime = 0;
  for (let i = 0; i < chunkPaths.length; i++) {
    const rawDur = await getAudioDurationSeconds(chunkPaths[i]);
    const effDur = +(rawDur / 1.25).toFixed(2);
    const start = currentTime;
    const end = +(currentTime + effDur).toFixed(2);
    currentTime = end;
    cues.push({ text: chunks[i], startTime: start, endTime: end });
  }

  const concatListFile = path.join(tempDir, `bm_concat_${timestamp}.txt`);
  fs.writeFileSync(concatListFile, chunkPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatListFile,
      '-filter:a', 'atempo=1.25', '-c:a', 'libmp3lame', '-b:a', '192k',
      finalAudioPath
    ]);
    child.on('close', (code) => (code === 0 ? resolve(true) : reject(new Error('Concat failed'))));
  });

  try { fs.unlinkSync(concatListFile); } catch {}
  for (const cp of chunkPaths) {
    try { if (fs.existsSync(cp)) fs.unlinkSync(cp); } catch {}
  }

  const duration = await getAudioDurationSeconds(finalAudioPath);
  const buffer = fs.readFileSync(finalAudioPath);
  if (cues.length > 0) {
    cues[cues.length - 1].endTime = Math.max(cues[cues.length - 1].endTime, duration);
  }

  return { duration, buffer, cues };
}

/**
 * Ana Seslendirme Fonksiyonu:
 * Önce insan doğallığındaki Neural Spiker (tr-TR-AhmetNeural) ile sentezler.
 * Herhangi bir ağ probleminde sıfır kesinti için otomatik Google TTS yedek motorunu devreye sokar.
 */
export async function synthesizeTurkishSpeech(narrationText: string): Promise<SynthesizedAudioResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const finalAudioPath = path.join(tempDir, `bm_tts_final_${timestamp}.mp3`);

  console.log(`[AudioSynthesizer] 🎙️ Starting Human-like Neural Voiceover synthesis (${narrationText.length} chars)...`);

  try {
    const result = await synthesizeWithNeuralTTS(narrationText, finalAudioPath);
    console.log(`[AudioSynthesizer] ✅ Human Neural Voiceover (tr-TR-AhmetNeural) ready: ${result.buffer.length} bytes, Duration: ${result.duration}s, Cues: ${result.cues.length}`);
    return {
      audioPath: finalAudioPath,
      durationSeconds: result.duration,
      buffer: result.buffer,
      cues: result.cues
    };
  } catch (err: any) {
    console.warn(`[AudioSynthesizer] ⚠️ Primary Neural TTS failed (${err.message}), engaging fail-safe fallback...`);
    const fallbackResult = await synthesizeWithGoogleTTSFallback(narrationText, finalAudioPath);
    console.log(`[AudioSynthesizer] ✅ Fallback Voiceover ready: ${fallbackResult.buffer.length} bytes, Duration: ${fallbackResult.duration}s`);
    return {
      audioPath: finalAudioPath,
      durationSeconds: fallbackResult.duration,
      buffer: fallbackResult.buffer,
      cues: fallbackResult.cues
    };
  }
}
