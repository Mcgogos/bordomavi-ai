import { AIProvider } from "./ai.provider.interface";

export class OpenAIProvider implements AIProvider {
  async generateContent(prompt: string): Promise<string> {
    console.log("[OpenAIProvider] Generating content...");
    return "OpenAI'den gelen içerik...";
  }

  async analyzeNews(newsText: string): Promise<any> {
    console.log("[OpenAIProvider] Analyzing news...");
    return {
      isTrabzonsporRelated: false,
      importanceScore: 80,
      credibilityScore: 85,
      confidenceLevel: "POSSIBLE",
      category: "NEWS",
    };
  }
}
