import { AIProvider } from "./ai.provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { NvidiaProvider } from "./nvidia.provider";

export type AIProviderName = "gemini" | "nvidia";
export type AITaskType = "NEWS_ANALYSIS" | "SUMMARY" | "FACEBOOK_POST" | "EDITORIAL_REVIEW" | "CONTENT_GENERATION";

export class AIRouter implements AIProvider {
  private gemini: GeminiProvider;
  private nvidia: NvidiaProvider;
  private taskType: AITaskType;

  constructor(taskType?: AITaskType) {
    this.taskType = taskType || "NEWS_ANALYSIS";
    this.gemini = new GeminiProvider();
    this.nvidia = new NvidiaProvider();
  }

  /**
   * PRIMARY: Gemini
   * FALLBACK: 13 sequential NVIDIA models (GPT-OSS -> GLM -> Nemotron -> MiniMax -> Kimi -> Llama -> Mistral ...)
   * Invisible to user, zero UI change.
   */
  async generateContent(prompt: string): Promise<string> {
    // 1. PRIMARY: Her zaman ilk olarak Gemini denenir
    try {
      return await this.gemini.generateContent(prompt);
    } catch (geminiError: any) {
      console.warn(`[AIRouter] Primary Gemini failed (${geminiError?.message?.slice(0, 80)}). Engaging 13-Model NVIDIA Fallback Chain...`);
    }

    // 2. FALLBACK: Sırasıyla 13 NVIDIA model zincirinden geçirilir
    try {
      return await this.nvidia.generateContent(prompt);
    } catch (nvidiaError: any) {
      console.error(`[AIRouter] NVIDIA Fallback chain exhausted (${nvidiaError?.message?.slice(0, 80)}).`);
      throw nvidiaError;
    }
  }

  async analyzeNews(newsData: any): Promise<any> {
    // 1. PRIMARY: Gemini
    try {
      return await this.gemini.analyzeNews(newsData);
    } catch (geminiError: any) {
      console.warn(`[AIRouter] Primary Gemini news analysis failed. Engaging NVIDIA Fallback Chain...`);
    }

    // 2. FALLBACK: NVIDIA
    try {
      return await this.nvidia.analyzeNews(newsData);
    } catch (nvidiaError: any) {
      console.error(`[AIRouter] NVIDIA news analysis fallback failed.`);
      throw nvidiaError;
    }
  }
}

export const aiRouter = new AIRouter();

