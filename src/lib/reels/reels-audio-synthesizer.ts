import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

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

/**
 * Uzun metinleri Türkçe cümle ve virgül sınırlarına göre akıcı altyazı dilimlerine (<85 karakter) böler.
 */
function splitTextIntoTTSChunks(text: string, maxLength: number = 70): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return [clean];

  const chunks: string[] = [];
  const sentences = clean.split(/(?<=[.!?,;:])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
      currentChunk = (currentChunk + ' ' + sentence).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (sentence.length <= maxLength) {
        currentChunk = sentence;
      } else {
        // Cümle tek başına maxLength'ten uzunsa kelimelere göre böl
        const words = sentence.split(' ');
        currentChunk = '';
        for (const w of words) {
          if ((currentChunk + ' ' + w).trim().length <= maxLength) {
            currentChunk = (currentChunk + ' ' + w).trim();
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = w;
          }
        }
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(c => c.trim().length > 0);
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
 * Verilen Türkçe metni Google TTS üzerinden akıcı bir MP3 seslendirmesine dönüştürür.
 * Çok parçalı metinleri kusursuz birleştirir ve net süresini döner.
 */
export async function synthesizeTurkishSpeech(narrationText: string): Promise<SynthesizedAudioResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const finalAudioPath = path.join(tempDir, `bm_tts_final_${timestamp}.mp3`);
  const chunkPaths: string[] = [];

  const chunks = splitTextIntoTTSChunks(narrationText);
  console.log(`[AudioSynthesizer] Synthesizing ${chunks.length} audio chunks for Turkish voiceover...`);

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkFile = path.join(tempDir, `bm_tts_chunk_${timestamp}_${i}.mp3`);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunkText)}&tl=tr&client=tw-ob`;

      let retries = 2;
      let downloaded = false;

      while (retries >= 0 && !downloaded) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000)
          });

          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > 200) {
              fs.writeFileSync(chunkFile, buffer);
              chunkPaths.push(chunkFile);
              downloaded = true;
            }
          }
        } catch (e: any) {
          console.warn(`[AudioSynthesizer] Chunk ${i} fetch attempt error (${e.message}), retrying...`);
          await new Promise(r => setTimeout(r, 400));
        }
        retries--;
      }

      if (!downloaded) {
        console.warn(`[AudioSynthesizer] Chunk ${i} failed to download.`);
      }
    }

    if (chunkPaths.length === 0) {
      throw new Error("Tüm seslendirme parçaları başarısız oldu.");
    }

    // Her ses parçasının 1.32x hızındaki süresini ve altyazı zamanlamasını hesapla
    const cues: SubtitleCue[] = [];
    let currentTime = 0;
    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkFile = chunkPaths[i];
      const chunkText = chunks[i];
      const rawDur = await getAudioDurationSeconds(chunkFile);
      const effDur = +(rawDur / 1.32).toFixed(2);
      const start = currentTime;
      const end = +(currentTime + effDur).toFixed(2);
      currentTime = end;
      cues.push({ text: chunkText, startTime: start, endTime: end });
    }

    // Parçaları FFmpeg ile kesintisiz birleştir
    const concatListFile = path.join(tempDir, `bm_concat_${timestamp}.txt`);
    const fileContent = chunkPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListFile, fileContent);

    // Parçaları FFmpeg ile birleştir ve 1.32x profesyonel haber temposuna hızlandır
    await new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListFile,
        '-filter:a', 'atempo=1.32',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        finalAudioPath
      ];
      const child = spawn(ffmpegPath, args);
      let errStr = '';
      child.stderr.on('data', (d) => { errStr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(finalAudioPath)) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg audio concat & tempo failed: ${errStr.slice(-200)}`));
        }
      });
    });

    try { fs.unlinkSync(concatListFile); } catch {}

    const duration = await getAudioDurationSeconds(finalAudioPath);
    const audioBuffer = fs.readFileSync(finalAudioPath);

    // Son altyazı zamanını toplam ses süresine uyarla
    if (cues.length > 0) {
      cues[cues.length - 1].endTime = Math.max(cues[cues.length - 1].endTime, duration);
    }

    console.log(`[AudioSynthesizer] ✅ Turkish Voiceover & ${cues.length} Cues generated: ${audioBuffer.length} bytes, Duration: ${duration}s`);

    return {
      audioPath: finalAudioPath,
      durationSeconds: duration,
      buffer: audioBuffer,
      cues
    };

  } finally {
    // Parça dosyaları temizle (ana final ses dosyasını silmiyoruz, çağıran temizleyecek)
    for (const cp of chunkPaths) {
      try { if (fs.existsSync(cp)) fs.unlinkSync(cp); } catch {}
    }
  }
}
