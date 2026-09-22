import { AIProvider } from "./ai.provider.interface";
import { NvidiaProvider } from "./nvidia.provider";

export type AIProviderName = "nvidia";
export type AITaskType = "NEWS_ANALYSIS" | "SUMMARY" | "FACEBOOK_POST" | "EDITORIAL_REVIEW" | "CONTENT_GENERATION";

export class AIRouter implements AIProvider {
  private nvidia: NvidiaProvider;
  private taskType: AITaskType;

  constructor(taskType?: AITaskType) {
    this.taskType = taskType || "NEWS_ANALYSIS";
    this.nvidia = new NvidiaProvider();
  }

  /**
   * PRIMARY & EXCLUSIVE: NVIDIA NIM & OpenRouter Açık Kaynak Model Ağı
   * (Llama 3.2 11B -> Nemotron 120B -> Nemotron 550B -> OpenRouter Free Yük Dengeleyici)
   * Sıfır Gemini API kullanımı, tam kota koruması.
   */
  async generateContent(prompt: string): Promise<string> {
    try {
      return await this.nvidia.generateContent(prompt);
    } catch (error: any) {
      console.error(`[AIRouter] NVIDIA/OpenRouter generation failed: ${error?.message?.slice(0, 100)}`);
      throw error;
    }
  }

  async analyzeNews(newsData: any): Promise<any> {
    try {
      return await this.nvidia.analyzeNews(newsData);
    } catch (error: any) {
      console.error(`[AIRouter] NVIDIA/OpenRouter news analysis failed: ${error?.message?.slice(0, 100)}`);
      throw error;
    }
  }
}

export const aiRouter = new AIRouter();

