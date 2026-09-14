import { AIProvider } from './ai.provider.interface';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GeminiProvider] Initialization failed: GEMINI_API_KEY is missing');
      throw new Error('Sistem hatası: AI servisi yapılandırılmamış.');
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(prompt: string): Promise<string> {
    console.log('[GeminiProvider] Generating content...');
    const modelName = process.env.AI_MODEL || 'gemini-3.1-flash-lite';
    try {
      const response = await this.client.models.generateContent({
        model: modelName,
        config: { temperature: 0.7 },
        contents: prompt
      });
      return response.text || '';
    } catch (error: any) {
      console.error('[GeminiProvider] Error:', error.message);
      throw error;
    }
  }

  async analyzeNews(newsData: any): Promise<any> {
    console.log('[GeminiProvider] Analyzing news...');
    const prompt = 'Aşağıdaki Trabzonspor haberini analiz et ve JSON formatında yanıt dön. Haber: ' + JSON.stringify(newsData) + ' Beklenen JSON formatı: { "importanceScore": (0-100), "credibilityScore": (0-100), "trabzonsporRelevanceScore": (0-100), "discussionPotentialScore": (0-100), "sharePotentialScore": (0-100), "viralPotentialScore": (0-100), "recommendedContentType": ("NEWS", "COLUMN", "POLL", "NOSTALGIA", "MATCH_PREVIEW", "TRANSFER", "PLAYER_ANALYSIS", "REELS_SCRIPT", "FAN_CONTENT", "QUESTION"), "recommendedAction": ("IGNORE", "MONITOR", "CREATE_CONTENT", "URGENT"), "shortSummary": "1-2 cümlelik özet", "keyPoints": ["önemli nokta 1", "önemli nokta 2"], "riskLevel": ("LOW", "MEDIUM", "HIGH"), "confidenceLevel": ("VERIFIED", "POSSIBLE", "CLAIM", "UNVERIFIED") } ÖNEMLİ: SADECE GEÇERLİ BİR JSON DÖNDÜR.';

    const modelName = process.env.AI_MODEL || 'gemini-3.1-flash-lite';

    try {
      let response;
      let attempt = 0;
      const maxAttempts = 2;
      while (attempt < maxAttempts) {
        try {
          const apiPromise = this.client.models.generateContent({
            model: modelName,
            config: { responseMimeType: 'application/json', temperature: 0.2 },
            contents: prompt
          });
          response = await Promise.race([
            apiPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini API timeout')), 15000))
          ]) as any;
          break;
        } catch (e) {
          attempt++;
          if (attempt >= maxAttempts) throw e;
          console.log('[GeminiProvider] Attempt ' + attempt + ' failed, retrying...');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      let text = response.text || '';
      let cleanText = text.trim();
      if (cleanText.startsWith('`json')) {
        cleanText = cleanText.replace(/`json\n?/, '').replace(/`$/, '').trim();
      } else if (cleanText.startsWith('`')) {
        cleanText = cleanText.replace(/`\n?/, '').replace(/`$/, '').trim();
      }
      return JSON.parse(cleanText);
    } catch (error: any) {
      console.error('[GeminiProvider] Analysis Error:', error.message);
      throw error;
    }
  }
}
