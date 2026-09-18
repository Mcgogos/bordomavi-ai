import { AIProvider } from './ai.provider.interface';
import { GoogleGenAI } from '@google/genai';

const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  process.env.AI_MODEL,
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
].filter(Boolean) as string[];

const MODEL_FALLBACK_POOL = Array.from(new Set(CANDIDATE_MODELS));

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
    let lastError: any = null;

    for (const modelName of MODEL_FALLBACK_POOL) {
      try {
        console.log(`[GeminiProvider] Generating content with model: ${modelName}...`);
        const response = await this.client.models.generateContent({
          model: modelName,
          config: { temperature: 0.7 },
          contents: prompt
        });
        const text = response.text || '';
        if (text) return text;
      } catch (error: any) {
        lastError = error;
        console.warn(`[GeminiProvider] Model ${modelName} failed (${error.status || error.message?.slice(0, 120)}). Trying fallback...`);
      }
    }

    console.error('[GeminiProvider] All Gemini models exhausted.');
    throw lastError || new Error('All Gemini models exhausted');
  }

  async analyzeNews(newsData: any): Promise<any> {
    console.log('[GeminiProvider] Analyzing news...');
    const prompt = 'Aşağıdaki Trabzonspor haberini analiz et ve JSON formatında yanıt dön. Haber: ' + JSON.stringify(newsData) + ' Beklenen JSON formatı: { "importanceScore": (0-100), "credibilityScore": (0-100), "trabzonsporRelevanceScore": (0-100), "discussionPotentialScore": (0-100), "sharePotentialScore": (0-100), "viralPotentialScore": (0-100), "recommendedContentType": ("NEWS", "COLUMN", "POLL", "NOSTALGIA", "MATCH_PREVIEW", "TRANSFER", "PLAYER_ANALYSIS", "REELS_SCRIPT", "FAN_CONTENT", "QUESTION"), "recommendedAction": ("IGNORE", "MONITOR", "CREATE_CONTENT", "URGENT"), "shortSummary": "1-2 cümlelik özet", "keyPoints": ["önemli nokta 1", "önemli nokta 2"], "riskLevel": ("LOW", "MEDIUM", "HIGH"), "confidenceLevel": ("VERIFIED", "POSSIBLE", "CLAIM", "UNVERIFIED") } ÖNEMLİ: SADECE GEÇERLİ BİR JSON DÖNDÜR.';

    let lastError: any = null;

    for (const modelName of MODEL_FALLBACK_POOL) {
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
            console.log(`[GeminiProvider] Model ${modelName} attempt ${attempt} failed, retrying...`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        
        let text = response.text || '';
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\n?/, '').replace(/```$/, '').trim();
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\n?/, '').replace(/```$/, '').trim();
        }
        return JSON.parse(cleanText);
      } catch (error: any) {
        lastError = error;
        console.warn(`[GeminiProvider] News analysis failed on ${modelName} (${error.status || error.message?.slice(0, 120)}). Trying fallback...`);
      }
    }

    console.error('[GeminiProvider] All Gemini models failed news analysis.');
    throw lastError || new Error('All Gemini models failed news analysis');
  }
}
