import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Require ffmpeg-static dynamically or standard require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

export interface GenerateReelParams {
  title: string;
  imageUrl?: string;
  durationSeconds?: number;
}

/**
 * 9:16 Dikey Formatlı Yüksek Kaliteli Otonom Facebook Reels Video Üreticisi
 * ffmpeg-static kullanarak haberi birkaç saniye içinde Meta uyumlu MP4 videoya dönüştürür.
 */
export async function generateReelVideoBuffer(params: GenerateReelParams): Promise<Buffer> {
  const { imageUrl, durationSeconds = 8 } = params;
  const tempDir = os.tmpdir();
  const timestamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tempInputImage = path.join(tempDir, `bm_reel_in_${timestamp}.png`);
  const tempOutputVideo = path.join(tempDir, `bm_reel_out_${timestamp}.mp4`);
  
  // Public logo fallback path
  const projectRoot = process.cwd();
  const logoPath = path.join(projectRoot, 'public', 'logo.png');

  try {
    // 1. Görseli Hazırla (Haber görseli veya yerel BordoMavi kurumsal logo)
    let hasValidImage = false;
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const res = await fetch(imageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BordoMaviReelEngine/1.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 500) {
            fs.writeFileSync(tempInputImage, buf);
            hasValidImage = true;
          }
        }
      } catch (err: any) {
        console.warn("[ReelVideoGenerator] Image fetch failed, using fallback:", err.message);
      }
    }

    if (!hasValidImage) {
      if (fs.existsSync(logoPath)) {
        fs.copyFileSync(logoPath, tempInputImage);
      } else {
        // Fallback boş 1x1 dosya oluşmasını önlemek için minik dummy PNG buffer yaz
        const dummyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
        fs.writeFileSync(tempInputImage, dummyPng);
      }
    }

    // 2. 9:16 Dikey (720x1280) Video Komutlarını Oluştur
    // Bordo renkli zemin (#580e1b), merkezde haber görseli ve sol üstte BordoMavi kulüp filigranı
    const hasLogo = fs.existsSync(logoPath);
    const args: string[] = [
      '-y',
      // Girdi 0: Bordo arkaplan tuvali (720x1280)
      '-f', 'lavfi',
      '-i', `color=c=0x580e1b:s=720x1280:d=${durationSeconds}:r=25`,
      // Girdi 1: Haber görseli
      '-loop', '1',
      '-i', tempInputImage
    ];

    if (hasLogo) {
      // Girdi 2: Kurumsal BordoMavi logosu
      args.push('-loop', '1', '-i', logoPath);
    }

    // Girdi 3 (veya 2): Meta Reels uyumlu sessiz stereo ses kanalı
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');

    // Filter Graph
    if (hasLogo) {
      args.push(
        '-filter_complex',
        `[1:v]scale=680:680:force_original_aspect_ratio=increase,crop=680:680,setsar=1[mainImg];` +
        `[2:v]scale=120:120,setsar=1[logoImg];` +
        `[0:v][mainImg]overlay=20:300[bgWithImg];` +
        `[bgWithImg][logoImg]overlay=30:50:shortest=1[outv]`,
        '-map', '[outv]',
        '-map', '3:a'
      );
    } else {
      args.push(
        '-filter_complex',
        `[1:v]scale=680:680:force_original_aspect_ratio=increase,crop=680:680,setsar=1[mainImg];` +
        `[0:v][mainImg]overlay=20:300:shortest=1[outv]`,
        '-map', '[outv]',
        '-map', '2:a'
      );
    }

    args.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-t', String(durationSeconds),
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-shortest',
      tempOutputVideo
    );

    console.log(`[ReelVideoGenerator] Generating 9:16 vertical Reel MP4 (${durationSeconds}s)...`);
    const start = Date.now();

    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args);
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempOutputVideo)) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-250)}`));
        }
      });
    });

    const elapsed = Date.now() - start;
    const videoBuffer = fs.readFileSync(tempOutputVideo);
    console.log(`[ReelVideoGenerator] ✅ Video Reel rendered successfully: ${videoBuffer.length} bytes in ${elapsed}ms`);
    return videoBuffer;

  } finally {
    // Geçici dosyaları temizle
    try { if (fs.existsSync(tempInputImage)) fs.unlinkSync(tempInputImage); } catch {}
    try { if (fs.existsSync(tempOutputVideo)) fs.unlinkSync(tempOutputVideo); } catch {}
  }
}
