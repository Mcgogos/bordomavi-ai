import fs from 'fs';
import { prisma } from '@/lib/db';
import { FacebookService } from '@/services/facebook.service';
import {
  discoverTrendingTrabzonsporVideos,
  inspectViralVideoUrl,
  markViralVideoAsPublished,
  ViralVideoCandidate,
} from './viral-video-discoverer';
import { processViralVideoIntoBrandedReel } from './viral-video-processor';

export interface ViralPublishResult {
  success: boolean;
  published?: boolean;
  facebookPostId?: string;
  contentId?: string;
  candidate?: ViralVideoCandidate;
  cleanTitle?: string;
  pollQuestion?: string;
  caption?: string;
  durationSeconds?: number;
  error?: string;
}

/**
 * İnternetteki en trend Trabzonspor viral videosunu otomatik bulur (veya verilen URL'yi kullanır),
 * yabancı sayfa logolarını/yazılarını temizler, Bordo-Mavi logomuzu ve sağlam içerik/anket tasarımımızı
 * ekleyerek doğrudan Facebook Reels olarak paylaşır.
 */
export async function runAutonomousViralReelPublisher(options?: {
  customVideoUrl?: string;
  customHeadline?: string;
  preferCategory?: 'Trabzon Yöresi' | 'Trabzonspor';
}): Promise<ViralPublishResult> {
  console.log('[ViralPublisher] 🚀 Starting Autonomous Viral Trabzonspor & Trabzon Region Reel Workflow...');

  let candidate: ViralVideoCandidate | null = null;

  let candidateQueue: ViralVideoCandidate[] = [];

  try {
    if (options?.customVideoUrl) {
      const single = await inspectViralVideoUrl(
        options.customVideoUrl,
        options.preferCategory === 'Trabzon Yöresi' ? 'TRABZON_YORESI' : undefined
      );
      if (!single) {
        return {
          success: false,
          error: `Belirtilen video URL'si incelenemedi veya uygun sürede değil: ${options.customVideoUrl}`,
        };
      }
      candidateQueue = [single];
    } else {
      const candidates = await discoverTrendingTrabzonsporVideos({
        limit: 8,
        includePublished: false,
        preferCategory: options?.preferCategory,
      });
      if (candidates.length === 0) {
        return {
          success: false,
          error: 'Şu anda paylaşılmamış yeni bir viral Trabzonspor/Trabzon videosu bulunamadı.',
        };
      }
      candidateQueue = candidates.slice(0, 4);
    }

    let processed: Awaited<ReturnType<typeof processViralVideoIntoBrandedReel>> | null = null;
    let lastProcessErr = '';

    for (const item of candidateQueue) {
      try {
        console.log(
          `[ViralPublisher] 🎯 Trying viral candidate: "${item.cleanTitle}" (Views: ${item.viewCount}, Likes: ${item.likeCount}, Score: ${item.viralScore})`
        );
        const res = await processViralVideoIntoBrandedReel({
          candidate: item,
          customHeadline: options?.customHeadline,
        });
        if (res.qualityResult.passed) {
          candidate = item;
          processed = res;
          break;
        } else {
          lastProcessErr = `Kalite kontrolü: ${res.qualityResult.errors.join(' | ')}`;
          for (const f of [res.videoFilePath, res.previewFramePath]) {
            try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
          }
        }
      } catch (candErr: any) {
        lastProcessErr = candErr.message || 'İndirme/işleme hatası';
        console.warn(`[ViralPublisher] Candidate "${item.cleanTitle}" failed (${lastProcessErr}), trying next candidate...`);
      }
    }

    if (!processed || !candidate) {
      return {
        success: false,
        candidate: candidateQueue[0],
        error: `Viral video adayları işlenemedi: ${lastProcessErr}`,
      };
    }

    try {

      console.log(
        `[ViralPublisher] 📤 Uploading branded viral Reel to Facebook (${(
          processed.videoBuffer.length /
          1024 /
          1024
        ).toFixed(2)} MB)...`
      );

      const fbResult = await FacebookService.publishReel(
        processed.videoBuffer,
        processed.caption,
        undefined,
        processed.srtContent
      );

      if (!fbResult.success) {
        return {
          success: false,
          candidate,
          cleanTitle: processed.cleanTitle,
          error: (fbResult as any).error || 'Facebook Reels yüklemesi başarısız oldu.',
        };
      }

      const postId = fbResult.postId || (fbResult as any).id;

      // Veritabanına kaydet & tekrar paylaşılmaması için işaretle
      await markViralVideoAsPublished({
        videoId: candidate.videoId,
        url: candidate.url,
        title: processed.cleanTitle,
        facebookPostId: postId,
      });

      const titlePrefix =
        candidate.category === 'Trabzon Yöresi' ? '[TRABZON YÖRESİ VİRAL]' : '[VİRAL REELS]';

      const contentRecord = await prisma.content.create({
        data: {
          type: 'REELS_SCRIPT',
          title: `${titlePrefix} ${processed.cleanTitle}`,
          body: processed.caption,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          facebookPostId: postId || null,
          viralScore: 95,
          qualityScore: 95,
          aiReasoning: `Autonomous Viral Reel Engine | Category: ${candidate.category} | Source: ${candidate.url} | Views: ${candidate.viewCount} | Poll: ${processed.pollQuestion}`,
        },
      });

      console.log(
        `[ViralPublisher] ✅ Published Viral Trabzonspor Reel! FB Post ID: ${postId}, Content ID: ${contentRecord.id}`
      );

      return {
        success: true,
        published: true,
        facebookPostId: postId,
        contentId: contentRecord.id,
        candidate,
        cleanTitle: processed.cleanTitle,
        pollQuestion: processed.pollQuestion,
        caption: processed.caption,
        durationSeconds: processed.durationSeconds,
      };
    } finally {
      // Geçici video ve önizleme dosyalarını temizle
      for (const f of [processed.videoFilePath, processed.previewFramePath]) {
        try {
          if (f && fs.existsSync(f)) fs.unlinkSync(f);
        } catch {}
      }
    }
  } catch (e: any) {
    console.error('[ViralPublisher] ❌ Error in autonomous viral publisher:', e);
    return {
      success: false,
      candidate: candidate || undefined,
      error: e.message || 'Bilinmeyen viral video işleme hatası.',
    };
  }
}
