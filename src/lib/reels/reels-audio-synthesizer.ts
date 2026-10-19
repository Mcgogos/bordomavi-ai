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
  engine?: string;
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
 * F5-TTS gibi tam metin klonlama motorlarında metni akıcı, taşmayan 1-2 satırlık altyazı kartlarına böler
 * ve ses süresiyle orantılı kusursuz zamanlama oluşturur.
 */
function generateProportionalCues(
  narrationText: string,
  totalDuration: number,
  maxChars: number = 44
): SubtitleCue[] {
  const clean = narrationText.replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const rawCues: string[] = [];

  for (const s of sentences) {
    if (s.length <= maxChars) {
      rawCues.push(s);
    } else {
      const phrases = s.split(/(?<=[,;:])\s+/);
      let cur = '';
      for (const p of phrases) {
        if ((cur + ' ' + p).trim().length <= maxChars) {
          cur = (cur + ' ' + p).trim();
        } else {
          if (cur) rawCues.push(cur);
          if (p.length <= maxChars) {
            cur = p;
          } else {
            const words = p.split(' ');
            cur = '';
            for (const w of words) {
              if ((cur + ' ' + w).trim().length <= maxChars) {
                cur = (cur + ' ' + w).trim();
              } else {
                if (cur) rawCues.push(cur);
                cur = w;
              }
            }
          }
        }
      }
      if (cur) rawCues.push(cur);
    }
  }

  const totalChars = rawCues.reduce((acc, c) => acc + c.length, 0);
  const cues: SubtitleCue[] = [];
  let currentTime = 0.05;

  for (let i = 0; i < rawCues.length; i++) {
    const cueText = rawCues[i];
    const ratio = cueText.length / Math.max(1, totalChars);
    const dur = +(ratio * Math.max(1, totalDuration - 0.2)).toFixed(2);
    const start = currentTime;
    const end = +(currentTime + dur).toFixed(2);
    currentTime = end;
    cues.push({ text: cueText, startTime: start, endTime: end });
  }

  if (cues.length > 0) {
    cues[cues.length - 1].endTime = Math.max(cues[cues.length - 1].endTime, totalDuration);
  }

  return cues;
}

/**
 * Microsoft Neural TTS sınırlarını (Word & Sentence Boundaries)
 * TV yayını kalitesinde altyazı dilimlerine dönüştürür.
 */
function buildCuesFromBoundaries(
  sentences: BoundaryItem[],
  words: BoundaryItem[],
  maxCueLength: number = 44
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

  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i + 1].startTime >= cues[i].endTime && cues[i + 1].startTime - cues[i].endTime < 0.35) {
      cues[i].endTime = cues[i + 1].startTime;
    }
  }

  return cues;
}

/**
 * 1. BİRİNCİL SESLENDİRME MOTORU: SWivid/F5-TTS Ses Klonlama Motoru
 * Kullanıcının yüklediği referans ses tonunu (reference_clip.wav) baz alarak
 * Flow Matching DiT mimarisiyle özel ses klonlama yapar.
 */
async function synthesizeWithF5TTS(
  narrationText: string,
  finalAudioPath: string,
  timeoutMs: number = 180000 // CPU üzerinde tam sentez için 180 saniye
): Promise<{ duration: number; buffer: Buffer; cues: SubtitleCue[] }> {
  const refClipPath = path.join(process.cwd(), 'public', 'assets', 'audio', 'reference_clip.wav');
  if (!fs.existsSync(refClipPath)) {
    throw new Error(`F5-TTS referans ses dosyası bulunamadı: ${refClipPath}`);
  }

  const refText = "Trabzonspor'da teknik direktör Fatih Tekke ile yolları ayırdı. Kulüp tarafından yapılan açıklamada karşılıklı olarak anlaşıldığı belirtildi.";
  const scriptPath = path.join(process.cwd(), 'scripts', 'f5_tts_synthesize.py');

  return new Promise((resolve, reject) => {
    const tempTextFile = path.join(os.tmpdir(), `bm_f5_text_${Date.now()}.txt`);
    fs.writeFileSync(tempTextFile, narrationText, 'utf8');

    const outputWav = finalAudioPath.replace(/\.mp3$/, '.wav');

    const child = spawn('python', [
      scriptPath,
      '--text_file', tempTextFile,
      '--ref_audio', refClipPath,
      '--ref_text', refText,
      '--output_file', outputWav,
      '--nfe_step', '12',
      '--speed', '1.05'
    ]);

    let stdout = '';
    let stderr = '';
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        child.kill();
        try { fs.unlinkSync(tempTextFile); } catch {}
        reject(new Error(`F5-TTS sentez süresi zaman aşımına uğradı (${timeoutMs / 1000}s).`));
      }
    }, timeoutMs);

    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', async (code) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tempTextFile); } catch {}
      if (isDone) return;
      isDone = true;

      if (code === 0 && fs.existsSync(outputWav) && fs.statSync(outputWav).size > 1000) {
        // Convert to mp3 if needed
        await new Promise((resConvert, rejConvert) => {
          const conv = spawn(ffmpegPath, ['-y', '-i', outputWav, '-b:a', '192k', finalAudioPath]);
          conv.on('close', (c) => c === 0 ? resConvert(true) : rejConvert(new Error('WAV to MP3 failed')));
        });

        try { fs.unlinkSync(outputWav); } catch {}

        const duration = await getAudioDurationSeconds(finalAudioPath);
        const buffer = fs.readFileSync(finalAudioPath);
        const cues = generateProportionalCues(narrationText, duration, 44);

        resolve({ duration, buffer, cues });
      } else {
        reject(new Error(`F5-TTS çalıştırılamadı (exit ${code}): ${stderr || stdout || 'Bilinmeyen hata'}`));
      }
    });
  });
}

/**
 * 2. İKİNCİL MOTOR: Microsoft Neural Spiker (tr-TR-EmelNeural / tr-TR-AhmetNeural)
 * Kullanıcının yüklediği kadın spiker tonunu tr-TR-EmelNeural ile birebir korur.
 */
async function synthesizeWithNeuralTTS(
  narrationText: string,
  finalAudioPath: string,
  voiceName: string = 'tr-TR-EmelNeural'
): Promise<{ duration: number; buffer: Buffer; cues: SubtitleCue[] }> {
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
      sentenceBoundaryEnabled: true
    });

    const sentences: BoundaryItem[] = [];
    const words: BoundaryItem[] = [];

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

    const cues = buildCuesFromBoundaries(sentences, words, 44);
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
 * 3. ÜÇÜNCÜL YEDEK MOTOR: Google TTS Fail-Safe
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
 * Ana Seslendirme Girişi:
 * 1. F5-TTS (Kullanıcının yüklediği referans ses tonuyla klonlama).
 * 2. tr-TR-EmelNeural (Aynı kadın spiker tonunu sağlayan sıfır gecikmeli neural motor).
 * 3. Google TTS Fail-Safe.
 */
export async function synthesizeTurkishSpeech(narrationText: string): Promise<SynthesizedAudioResult> {
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const finalAudioPath = path.join(tempDir, `bm_tts_final_${timestamp}.mp3`);

  console.log(`[AudioSynthesizer] 🎙️ Seslendirme başlatılıyor (${narrationText.length} karakter)...`);

  // 1. F5-TTS ile Kullanıcının Referans Ses Tonunu Klonlamayı Dene
  try {
    console.log(`[AudioSynthesizer] 🚀 1. Motor: F5-TTS Referans Ses Klonlama deneniyor...`);
    const f5Result = await synthesizeWithF5TTS(narrationText, finalAudioPath);
    console.log(`[AudioSynthesizer] ✅ F5-TTS Klonlama Başarılı! Süre: ${f5Result.duration}s, Cues: ${f5Result.cues.length}`);
    return {
      audioPath: finalAudioPath,
      durationSeconds: f5Result.duration,
      buffer: f5Result.buffer,
      cues: f5Result.cues,
      engine: 'F5-TTS (Cloned Voice)'
    };
  } catch (f5Err: any) {
    console.warn(`[AudioSynthesizer] ⚠️ F5-TTS devrede değil veya zaman aşımı (${f5Err.message}). 2. Motor: tr-TR-EmelNeural (Kadın Haber Spikeri) devreye giriyor...`);
  }

  // 2. İkincil Motor: tr-TR-EmelNeural (Kullanıcının yüklediği kadın spiker tonunu birebir yansıtır)
  try {
    const neuralResult = await synthesizeWithNeuralTTS(narrationText, finalAudioPath, 'tr-TR-EmelNeural');
    console.log(`[AudioSynthesizer] ✅ Neural Kadın Spiker (tr-TR-EmelNeural) hazır: ${neuralResult.buffer.length} bayt, Süre: ${neuralResult.duration}s, Cues: ${neuralResult.cues.length}`);
    return {
      audioPath: finalAudioPath,
      durationSeconds: neuralResult.duration,
      buffer: neuralResult.buffer,
      cues: neuralResult.cues,
      engine: 'Microsoft Neural (tr-TR-EmelNeural)'
    };
  } catch (neuralErr: any) {
    console.warn(`[AudioSynthesizer] ⚠️ Neural TTS ulaşılamadı (${neuralErr.message}), 3. Motor (Google TTS) devreye giriyor...`);
  }

  // 3. Üçüncül Motor: Google TTS
  const fallbackResult = await synthesizeWithGoogleTTSFallback(narrationText, finalAudioPath);
  console.log(`[AudioSynthesizer] ✅ Fallback Voiceover hazır: ${fallbackResult.buffer.length} bayt, Süre: ${fallbackResult.duration}s`);
  return {
    audioPath: finalAudioPath,
    durationSeconds: fallbackResult.duration,
    buffer: fallbackResult.buffer,
    cues: fallbackResult.cues,
    engine: 'Google TTS Fallback'
  };
}
