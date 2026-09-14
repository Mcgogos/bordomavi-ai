import { prisma } from '@/lib/db';
import { AIFactory } from '@/services/ai/ai.factory';

const checkingIds = new Set<string>();

export async function checkContentQuality(limit: number = 5) {
  const result = {
    success: true,
    requested: limit,
    processed: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
    results: [] as any[]
  };

  try {
    const candidateContents = await prisma.content.findMany({
      where: {
        status: 'DRAFT',
        qualityScore: null,
        qualityCheckAttempts: { lt: 3 }
      },
      include: { sourceNews: true },
      take: limit * 2,
      orderBy: { createdAt: 'desc' }
    });

    if (candidateContents.length === 0) {
      console.log("[Quality Checker] No DRAFT content to check.");
      return result;
    }

    const aiProvider = AIFactory.getRouter("EDITORIAL_REVIEW");

    for (const content of candidateContents) {
      if (result.processed + result.failed >= limit) break;
      if (checkingIds.has(content.id)) continue;

      checkingIds.add(content.id);

      try {
        console.log(`[Quality Checker] Checking content ID: ${content.id}`);

        const prompt = `
Aşağıdaki Facebook içerik taslağını kalite kontrolünden geçir.

Haber Kaynağı Başlığı: ${content.sourceNews?.title || 'Bilinmiyor'}
Haber Kaynağı Özeti: ${content.sourceNews?.summary || content.sourceNews?.aiSummary || 'Bilinmiyor'}

Taslak İçerik:
${content.body}

Lütfen şu kriterlere göre değerlendir:
1. Haber gerçekten Trabzonspor ile ilgili mi?
2. İçerik kaynak habere sadık mı? Uydurma bilgi (halüsinasyon) var mı?
3. İddia kesin gerçek gibi mi yazılmış?
4. Hakaret, küfür veya uygunsuz ifade var mı?
5. Başlık yanıltıcı mı? Facebook formatına ve Bordo Mavi diline uygun mu?
6. Hashtag'ler uygun mu?

Yanıtını SADECE aşağıdaki formata uygun bir JSON nesnesi olarak döndür (asla fazladan metin veya markdown ekleme):
{
  "approved": boolean,
  "qualityScore": number (0-100 arasi),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "reason": "kisa aciklama",
  "correctedContent": "varsa duzeltilmis icerik, yoksa orijinalini ver"
}
`;

        const responseText = await aiProvider.generateContent(prompt);
        
        // Temizle ve parse et (JSON string'i markdown tag'leri icinde gelebilir)
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        let newStatus = 'REJECTED';
        if (parsed.approved === true && parsed.qualityScore >= 75 && parsed.riskLevel !== 'HIGH') {
            newStatus = 'READY_TO_PUBLISH';
            result.approved++;
        } else {
            result.rejected++;
        }

        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: newStatus as any,
            qualityScore: parsed.qualityScore,
            aiReasoning: parsed.reason,
            body: parsed.correctedContent || content.body
          }
        });

        result.processed++;
        result.results.push({ contentId: content.id, status: newStatus, score: parsed.qualityScore });
        console.log(`[Quality Checker] Done for ${content.id}: ${newStatus}`);

      } catch (err: any) {
        console.error(`[Quality Checker] Error checking content ${content.id}:`, err);
        result.failed++;
        result.results.push({ contentId: content.id, error: err.message });

        const currentAttempts = typeof content.qualityCheckAttempts === 'number' ? content.qualityCheckAttempts : 0;
        const newAttempts = currentAttempts + 1;
        const newStatus = newAttempts >= 3 ? 'FAILED' : 'DRAFT';

        await prisma.content.update({
          where: { id: content.id },
          data: {
            qualityCheckAttempts: newAttempts,
            status: newStatus,
            aiReasoning: (content.aiReasoning ? content.aiReasoning + '\n' : '') + 'Quality Check Error: ' + err.message
          }
        });
      } finally {
        checkingIds.delete(content.id);
      }
    }

    return result;
  } catch (error: any) {
    console.error("[Quality Checker] Fatal error:", error);
    result.success = false;
    // @ts-ignore
    result.error = error.message;
    return result;
  }
}
