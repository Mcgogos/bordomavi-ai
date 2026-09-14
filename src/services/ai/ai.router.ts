import { AIProvider } from "./ai.provider.interface";
import { GeminiProvider } from "./gemini.provider";

export type AIProviderName = "gemini";
export type AITaskType = "NEWS_ANALYSIS" | "SUMMARY" | "FACEBOOK_POST" | "EDITORIAL_REVIEW" | "CONTENT_GENERATION";

export class AIRouter implements AIProvider {
  private gemini: GeminiProvider;
  private taskType: AITaskType;

  constructor(taskType?: AITaskType) {
    this.taskType = taskType || "NEWS_ANALYSIS";
    this.gemini = new GeminiProvider();
  }

  async generateContent(prompt: string, context?: any, systemInstruction?: string): Promise<string> {
    return this.gemini.generateContent(prompt, context, systemInstruction);
  }

  async analyzeNews(newsData: any): Promise<any> {
    return this.gemini.analyzeNews(newsData);
  }
}

export const aiRouter = new AIRouter();
