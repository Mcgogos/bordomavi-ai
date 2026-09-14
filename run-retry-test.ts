import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { prisma } from './src/lib/db';
import { analyzePendingNews } from './src/lib/news/news-ai-analyzer';
import { checkContentQuality } from './src/lib/content/content-quality-checker';
import { AIFactory } from './src/services/ai/ai.factory';

// Mock AIFactory to always throw errors
AIFactory.getProvider = () => ({
  analyzeNews: async () => { throw new Error("Simulated AI Analyzer Error"); },
  generateContent: async () => { throw new Error("Simulated AI Content Error"); }
}) as any;

(async () => {
  try {
    console.log("Setting up DB state for test...");

    // 1. Create a dummy News that will fail analysis
    const dummyNews = await prisma.news.create({
      data: {
        title: 'Test Analiz Hatası Haber',
        url: 'https://test-analyzer-error-' + Date.now() + '.com',
        publishedAt: new Date(),
        isProcessed: false,
        source: {
          connectOrCreate: {
            where: { id: 'mock-source' },
            create: { id: 'mock-source', name: 'Mock Source', url: 'test.com', type: 'LOCAL' }
          }
        }
      }
    });

    console.log("Created dummy news:", dummyNews.id);

    // 2. Run Analyzer 4 times
    for (let i = 1; i <= 4; i++) {
        console.log(`\n--- Analyzer Run ${i} ---`);
        await analyzePendingNews(10);
        const checkNews = await prisma.news.findUnique({ where: { id: dummyNews.id } });
        console.log(`News Attempts: ${checkNews?.analysisAttempts}, Error: ${checkNews?.aiAnalysisError}`);
    }

    // 3. Create a dummy DRAFT Content that will fail quality check
    const dummyContent = await prisma.content.create({
      data: {
        type: 'NEWS',
        title: 'Test Quality Hatası İçerik',
        body: 'Bu hatalı bir içerik',
        status: 'DRAFT',
        qualityScore: null
      }
    });

    console.log("\nCreated dummy DRAFT content:", dummyContent.id);

    // 4. Run Quality Checker 4 times
    for (let i = 1; i <= 4; i++) {
        console.log(`\n--- Quality Check Run ${i} ---`);
        await checkContentQuality(5);
        const checkContent = await prisma.content.findUnique({ where: { id: dummyContent.id } });
        console.log(`Content Attempts: ${checkContent?.qualityCheckAttempts}, Status: ${checkContent?.status}`);
    }

    console.log("\nTest Completed.");

  } catch (error) {
    console.error("Test Error:", error);
  }
})();
