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
}): Promise<ViralPublishResult> {
  console.log('[ViralPublisher] 🚀 Starting Autonomous Viral Trabzonspor Reel Workflow...');

  let candidate: ViralVideoCandidate | null = null;

  try {
    if (options?.customVideoUrl) {
      candidate = await inspectViralVideoUrl(options.customVideoUrl);
      if (!candidate) {
        return {
          success: false,
          error: `Belirtilen video URL'si incelenemedi veya uygun sürede değil: ${options.customVideoUrl}`,
        };
      }
    } else {
      const candidates = await discoverTrendingTrabzonsporVideos({ limit: 5, includePublished: false });
      if (candidates.length === 0) {
        return {
          success: false,
          error: 'Şu anda paylaşılmamış yeni bir viral Trabzonspor videosu bulunamadı.',
        };
      }
      candidate = candidates[0];
    }

    console.log(
      `[ViralPublisher] 🎯 Selected top viral candidate: "${candidate.cleanTitle}" (Views: ${candidate.viewCount}, Likes: ${candidate.likeCount}, Score: ${candidate.viralScore})`
    );

    const processed = await processViralVideoIntoBrandedReel({
      candidate,
      customHeadline: options?.customHeadline,
    });

    try {
      if (!processed.qualityResult.passed) {
        return {
          success: false,
          candidate,
          error: `Viral Reels kalite kontrolünden geçemedi: ${processed.qualityResult.errors.join(' | ')}`,
        };
      }

      console.log(
        `[ViralPublisher] 📤 Uploading branded viral Reel to Facebook (${(
          processed.videoBuffer.length /
          1024 /
          1024
        ).toFixed(2)} MB)...`
      );

      const fbResult = await FacebookService.publishReel(processed.videoBuffer, processed.caption);

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

      const contentRecord = await prisma.content.create({
        data: {
          type: 'REELS_SCRIPT',
          title: `[VİRAL REELS] ${processed.cleanTitle}`,
          body: processed.caption,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          facebookPostId: postId || null,
          viralScore: 95,
          qualityScore: 95,
          aiReasoning: `Autonomous Viral Reel Engine | Source: ${candidate.url} | Views: ${candidate.viewCount} | Poll: ${processed.pollQuestion}`,
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
