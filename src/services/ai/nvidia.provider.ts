import { AIProvider } from './ai.provider.interface';

/**
 * NVIDIA NIM AI Provider
 * 
 * Primary: Gemini.
 * Fallback: 13 NVIDIA NIM models in exact sequential order as requested:
 *  1. GPT-OSS 120B — /gpt-oss (openai/gpt-oss-120b, openai/gpt-oss-20b)
 *  2. GLM 5.2 — z-ai/glm-5.2 (z-ai/glm-5.3, z-ai/glm-5.3-flash)
 *  3. Nemotron-3 Super 120B — nvidia/nemotron-3-super-120b-a12b
 *  4. MiniMax M3 — minimaxai/minimax-m3
 *  5. Kimi K2.6 — moonshotai/kimi-k2.6 (moonshotai/kimi-k3)
 *  6. Llama 3.3 70B — /llama (meta/llama-3.3-70b-instruct, nvidia/llama-3.1-nemotron-70b-instruct)
 *  7. Nemotron 70B — /nemotron70b (nvidia/llama-3.1-nemotron-70b-instruct)
 *  8. Nemotron Ultra 253B — nvidia/llama-3.1-nemotron-ultra-253b-v1
 *  9. Nemotron Super 49B v1.5 — nvidia/llama-3.3-nemotron-super-49b-v1.5
 * 10. Mistral Large 2 — /mistral (mistralai/mistral-large-2-instruct, mistralai/mistral-large)
 * 11. Codestral 22B — /codestral (mistralai/codestral-22b-instruct-v0.1)
 * 12. Llama 3.2 90B Vision — /llama-vision (meta/llama-3.2-90b-vision-instruct)
 * 13. Nemotron Nano VL 12B — nvidia/nemotron-nano-12b-v2-vl (nv-mistralai/mistral-nemo-12b-instruct)
 */

export interface FallbackModelDef {
  name: string;
  candidateIds: string[];
}

export const NVIDIA_FALLBACK_MODELS: FallbackModelDef[] = [
  { name: '1. GPT-OSS 120B (/gpt-oss)', candidateIds: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gpt-oss'] },
  { name: '2. GLM 5.2 (z-ai/glm-5.2)', candidateIds: ['z-ai/glm-5.2', 'z-ai/glm-5.3', 'z-ai/glm-5.3-flash'] },
  { name: '3. Nemotron-3 Super 120B', candidateIds: ['nvidia/nemotron-3-super-120b-a12b'] },
  { name: '4. MiniMax M3', candidateIds: ['minimaxai/minimax-m3'] },
  { name: '5. Kimi K2.6', candidateIds: ['moonshotai/kimi-k2.6', 'moonshotai/kimi-k3'] },
  { name: '6. Llama 3.3 70B (/llama)', candidateIds: ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama2-70b'] },
  { name: '7. Nemotron 70B (/nemotron70b)', candidateIds: ['nvidia/llama-3.1-nemotron-70b-instruct', 'nemotron-4-340b-instruct'] },
  { name: '8. Nemotron Ultra 253B', candidateIds: ['nvidia/llama-3.1-nemotron-ultra-253b-v1'] },
  { name: '9. Nemotron Super 49B v1.5', candidateIds: ['nvidia/llama-3.3-nemotron-super-49b-v1.5', 'nvidia/nemotron-3-super-120b-a12b'] },
  { name: '10. Mistral Large 2 (/mistral)', candidateIds: ['mistralai/mistral-large-2-instruct', 'mistralai/mistral-large', 'mistralai/mistral-7b-instruct-v0.3'] },
  { name: '11. Codestral 22B (/codestral)', candidateIds: ['mistralai/codestral-22b-instruct-v0.1'] },
  { name: '12. Llama 3.2 90B Vision (/llama-vision)', candidateIds: ['meta/llama-3.2-90b-vision-instruct', 'meta/llama-3.2-11b-vision-instruct'] },
  { name: '13. Nemotron Nano VL 12B', candidateIds: ['nvidia/nemotron-nano-12b-v2-vl', 'nv-mistralai/mistral-nemo-12b-instruct', 'nvidia/nemotron-nano-3-30b-a3b'] },
];

export class NvidiaProvider implements AIProvider {
  private apiKey: string;
  private baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.NVIDIA_API_KEY || '';
  }

  private isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.startsWith('nvapi-'));
  }

  async generateContent(prompt: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('[NvidiaProvider] NVIDIA_API_KEY is missing or invalid');
    }

    let lastError: any = null;

    for (const step of NVIDIA_FALLBACK_MODELS) {
      for (const modelId of step.candidateIds) {
        try {
          console.log(`[NvidiaProvider] Trying model: ${step.name} (${modelId})...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const res = await fetch(this.baseUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              model: modelId,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 1024
            })
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || '';
            if (text.trim()) {
              console.log(`[NvidiaProvider] SUCCESS with ${step.name} (${modelId})`);
              return text;
            }
          } else {
            const errText = await res.text();
            console.warn(`[NvidiaProvider] Model ${modelId} returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
            lastError = new Error(`HTTP ${res.status} from ${modelId}`);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[NvidiaProvider] Model ${modelId} failed (${err.message}). Trying next in chain...`);
        }
      }
    }

    throw lastError || new Error('All NVIDIA models in fallback chain failed');
  }

  async analyzeNews(newsData: any): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('[NvidiaProvider] NVIDIA_API_KEY is missing or invalid');
    }

    const prompt = 'Aşağıdaki Trabzonspor haberini analiz et ve SADECE JSON formatında yanıt dön. Haber: ' + JSON.stringify(newsData) + ' Beklenen JSON formatı: { "importanceScore": 85, "credibilityScore": 90, "trabzonsporRelevanceScore": 95, "discussionPotentialScore": 80, "sharePotentialScore": 85, "viralPotentialScore": 88, "recommendedContentType": "NEWS", "recommendedAction": "CREATE_CONTENT", "shortSummary": "Haberin özeti", "keyPoints": ["Madde 1", "Madde 2"], "riskLevel": "LOW", "confidenceLevel": "VERIFIED" }';

    const raw = await this.generateContent(prompt);
    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json\n?/, '').replace(/```$/, '').trim();
    else if (clean.startsWith('```')) clean = clean.replace(/^```\n?/, '').replace(/```$/, '').trim();

    return JSON.parse(clean);
  }
}
