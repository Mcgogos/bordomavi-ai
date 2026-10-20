import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { prisma } from '../src/lib/db';
import { generateCompleteReelVideo } from '../src/lib/reels/reel-video-generator';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static');

async function main() {
  const news = await prisma.news.findFirst({
    where: { id: 'cmvg9yr9r0003yvk29yaxi280' }
  }) || await prisma.news.findFirst({
    where: { imageUrl: { not: null } },
    orderBy: { publishedAt: 'desc' }
  });

  if (!news) {
    throw new Error('Veritabanında görselli haber bulunamadı.');
  }

  console.log('Selected News:', news.title);

  const res = await generateCompleteReelVideo({
    title: news.title,
    summary: news.summary,
    body: (news as any).body || news.summary,
    imageUrl: news.imageUrl,
    category: news.category,
    sourceNewsId: news.id,
    skipHistoryCheck: true
  });

  const desktopMp4 = 'C:/Users/win11.BT-20989/Desktop/ornek_trabzonspor_reel.mp4';
  const publicMp4 = path.join(process.cwd(), 'public', 'ornek_trabzonspor_reel.mp4');
  const artifactDir = 'C:/Users/win11.BT-20989/.gemini/antigravity/brain/48859081-8fbc-48bb-a58f-682d59b5d1ed';
  const artifactMp4 = path.join(artifactDir, 'ornek_trabzonspor_reel.mp4');
  const artifactPng = path.join(artifactDir, 'ornek_trabzonspor_reel_onizleme.png');

  fs.copyFileSync(res.videoFilePath, desktopMp4);
  fs.copyFileSync(res.videoFilePath, publicMp4);
  fs.copyFileSync(res.videoFilePath, artifactMp4);

  spawnSync(ffmpegPath, ['-y', '-ss', '00:00:12.0', '-i', artifactMp4, '-frames:v', '1', artifactPng]);

  try {
    if (fs.existsSync(res.videoFilePath)) fs.unlinkSync(res.videoFilePath);
  } catch {}

  console.log('====================================');
  console.log('✅ ÖRNEK REELS VİDEOSU HAZIR!');
  console.log('Masaüstü Yolu:', desktopMp4);
  console.log('Proje Yolu:', publicMp4);
  console.log('Süre:', res.durationSeconds, 'sn');
  console.log('Seslendirme Metni:', res.scriptData.fullNarration);
  console.log('Anket Sorusu:', res.scriptData.pollQuestion);
  console.log('Şıklar:', res.scriptData.pollOption1, '|', res.scriptData.pollOption2);
  console.log('====================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('HATA:', err);
  process.exit(1);
});
