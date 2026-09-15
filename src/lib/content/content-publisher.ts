import { prisma } from '@/lib/db';
import { FacebookService } from '@/services/facebook.service';

const publishingIds = new Set<string>();

export async function publishReadyContent(limit: number = 1) {
  const result = {
    success: true,
    requested: limit,
    processed: 0,
    failed: 0,
    results: [] as any[]
  };

  try {
    const readyContents = await prisma.content.findMany({
      where: {
        status: 'READY_TO_PUBLISH',
        facebookPostId: null
      },
      include: {
        sourceNews: true
      },
      take: limit * 2,
      orderBy: { createdAt: 'desc' }
    });

    if (readyContents.length === 0) {
      console.log("[Content Publisher] No READY_TO_PUBLISH content found.");
      return result;
    }

    for (const content of readyContents) {
      if (result.processed + result.failed >= limit) break;
      if (publishingIds.has(content.id)) continue;

      publishingIds.add(content.id);

      try {
        console.log(`[Content Publisher] Publishing content ID: ${content.id}`);

        let messageBody = content.title + '\n\n' + content.body;
        if (content.hashtags) {
          messageBody += '\n\n' + content.hashtags;
        }

        // Dinamik görsel (OG Image) URL'sini oluştur.
        // Orijinal haberdeki fotoğrafı arka plan olarak kullanmak için imageUrl ekle
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai-editor.netlify.app';
        let mediaUrl = `${appUrl}/api/og?title=${encodeURIComponent(content.title)}`;
        
        if (content.sourceNews?.imageUrl) {
          mediaUrl += `&imageUrl=${encodeURIComponent(content.sourceNews.imageUrl)}`;
        }

        // Facebook'a hem metni hem de görseli (logo ile watermarklanmis) gonder.
        const publishResponse = await FacebookService.publishPost(messageBody, mediaUrl);

        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'PUBLISHED',
            facebookPostId: publishResponse.postId,
            publishedAt: new Date()
          }
        });

        result.processed++;
        result.results.push({ contentId: content.id, status: 'PUBLISHED', facebookPostId: publishResponse.postId, mockMode: publishResponse.mockMode });
        console.log(`[Content Publisher] Done for ${content.id}: ${publishResponse.postId}`);

      } catch (err: any) {
        console.error(`[Content Publisher] Error publishing content ${content.id}:`, err);
        result.failed++;
        // Don't fail the content status permanently yet, or set it to FAILED depending on the error
        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'FAILED',
            aiReasoning: (content.aiReasoning ? content.aiReasoning + '\n' : '') + 'Yayinlama Hatasi: ' + err.message
          }
        });
        result.results.push({ contentId: content.id, error: err.message });
      } finally {
        publishingIds.delete(content.id);
      }
    }

    return result;
  } catch (error: any) {
    console.error("[Content Publisher] Fatal error:", error);
    result.success = false;
    // @ts-ignore
    result.error = error.message;
    return result;
  }
}
