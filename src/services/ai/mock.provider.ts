import { AIProvider } from "./ai.provider.interface";

export class MockProvider implements AIProvider {
  async generateContent(prompt: string): Promise<string> {
    console.log("[MockProvider] Generating content...");
    if (prompt.includes("kalite kontrol")) {
      return JSON.stringify({
        approved: true,
        qualityScore: 90,
        riskLevel: "LOW",
        reason: "Haber guvenilir ve formata uygun.",
        correctedContent: "Mock corrected content"
      });
    }
    return "Gemini (Mock) icerik: " + prompt;
  }

  async analyzeNews(newsData: any): Promise<any> {
    console.log("[MockProvider] Analyzing news...");
    return {
      isTrabzonsporRelated: false,
      importanceScore: 50,
      credibilityScore: 50,
      trabzonsporRelevanceScore: 50,
      discussionPotentialScore: 50,
      sharePotentialScore: 50,
      viralPotentialScore: 50,
      recommendedContentType: "NEWS",
      recommendedAction: "MONITOR",
      shortSummary: "Mock summary for testing",
      keyPoints: ["Point 1", "Point 2"],
      riskLevel: "LOW",
      confidence: "MEDIUM"
    };
  }
}
