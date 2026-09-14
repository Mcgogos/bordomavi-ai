import { AIProvider } from "./ai.provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { NvidiaProvider } from "./nvidia.provider";

export type AIProviderName = "gemini" | "nvidia" | "auto";
export type AITaskType = "NEWS_ANALYSIS" | "SUMMARY" | "FACEBOOK_POST" | "EDITORIAL_REVIEW" | "CONTENT_GENERATION";

// Bu ayarlar normalde veritabanından veya yönetim panelinden gelebilir.
// Şimdilik konfigürasyon objesinde saklıyoruz.
export const AI_TASK_CONFIG: Record<AITaskType, AIProviderName> = {
  NEWS_ANALYSIS: "gemini", // NVIDIA varsayılan olarak seçildi
  SUMMARY: "gemini",
  FACEBOOK_POST: "gemini", // Gemini varsayılan
  EDITORIAL_REVIEW: "gemini",
  CONTENT_GENERATION: "auto"
};

// Basit Rate Limit ve Hata takibi için state
interface ProviderStats {
  requests: number;
  errors: number;
  rateLimits: number;
  lastSuccess?: Date;
  lastError?: Date;
  status: "ACTIVE" | "DOWN" | "RATE_LIMITED";
}

export const AI_PROVIDER_STATS: Record<string, ProviderStats> = {
  gemini: { requests: 0, errors: 0, rateLimits: 0, status: "ACTIVE" },
  nvidia: { requests: 0, errors: 0, rateLimits: 0, status: "ACTIVE" }
};

export class AIRouter implements AIProvider {
  private gemini: GeminiProvider;
  private nvidia: NvidiaProvider;
  private taskType: AITaskType;
  private maxRetries = 1; // Her sağlayıcı için 1 retry (Fallback dahil)

  constructor(taskType: AITaskType) {
    this.taskType = taskType;
    this.gemini = new GeminiProvider();
    this.nvidia = new NvidiaProvider();
  }

  private logOperation(provider: string, task: string, status: string, responseTime: number, errorType?: string) {
    // 11. İster: AI Kullanım Logları (örnek format: NVIDIA | news_analysis | model-x | SUCCESS | 840ms)
    console.log(`[AI_LOG] ${provider} | ${task} | ${status} | ${responseTime}ms${errorType ? ` | ${errorType}` : ''} | ${new Date().toISOString()}`);
  }

  private updateStats(provider: "gemini" | "nvidia", isSuccess: boolean, error?: any) {
    const stats = AI_PROVIDER_STATS[provider];
    stats.requests++;
    
    if (isSuccess) {
      stats.lastSuccess = new Date();
      stats.status = "ACTIVE";
    } else {
      stats.errors++;
      stats.lastError = new Date();
      
      const isRateLimit = error?.message?.includes("429") || error?.message?.includes("Quota");
      if (isRateLimit) {
        stats.rateLimits++;
        stats.status = "RATE_LIMITED";
        // Simple cooldown logic: Reset status after 1 minute (for a real app use Redis/cron)
        setTimeout(() => {
          if (AI_PROVIDER_STATS[provider].status === "RATE_LIMITED") {
            AI_PROVIDER_STATS[provider].status = "ACTIVE";
          }
        }, 60000);
      } else {
        stats.status = "DOWN"; // Veya geçici hata
      }
    }
  }

  private async executeWithFallback<T>(operation: (provider: AIProvider) => Promise<T>): Promise<T> {
    const preferredProviderName = AI_TASK_CONFIG[this.taskType] || "auto";
    
    let primary: AIProvider;
    let primaryName: "gemini" | "nvidia";
    let secondary: AIProvider;
    let secondaryName: "gemini" | "nvidia";

    // "auto" mantığı: Hangi provider "ACTIVE" ise onu seç. 
    // Öncelik olarak Nvidia'yı deneyebiliriz, eğer o rate_limited ise Gemini'ye geçer.
    if (preferredProviderName === "gemini" || (preferredProviderName === "auto" && AI_PROVIDER_STATS.gemini.status === "ACTIVE")) {
      primary = this.gemini;
      primaryName = "gemini";
      secondary = this.nvidia;
      secondaryName = "nvidia";
    } else {
      primary = this.nvidia;
      primaryName = "nvidia";
      secondary = this.gemini;
      secondaryName = "gemini";
    }

    const startTime = Date.now();
    try {
      if (AI_PROVIDER_STATS[primaryName].status === "RATE_LIMITED") {
        throw new Error("Provider currently RATE_LIMITED"); // Force fallback if primary is already known down
      }
      
      const result = await operation(primary);
      const endTime = Date.now();
      
      this.updateStats(primaryName, true);
      this.logOperation(primaryName, this.taskType, "SUCCESS", endTime - startTime);
      return result;
      
    } catch (primaryError: any) {
      const endTime = Date.now();
      const isRateLimit = primaryError.message.includes("429") || primaryError.message.includes("RATE_LIMITED") || primaryError.message.includes("Quota");
      
      this.updateStats(primaryName, false, primaryError);
      this.logOperation(primaryName, this.taskType, isRateLimit ? "RATE_LIMIT" : "ERROR", endTime - startTime, primaryError.message);
      
      console.log(`[AIRouter] ${primaryName} failed (${primaryError.message}). Fallback to ${secondaryName}...`);
      
      // FALLBACK
      const fallbackStartTime = Date.now();
      try {
        const result = await operation(secondary);
        const fallbackEndTime = Date.now();
        
        this.updateStats(secondaryName, true);
        this.logOperation(secondaryName, this.taskType, "SUCCESS", fallbackEndTime - fallbackStartTime);
        return result;
        
      } catch (secondaryError: any) {
        const fallbackEndTime = Date.now();
        const isSecRateLimit = secondaryError.message.includes("429") || secondaryError.message.includes("Quota");
        
        this.updateStats(secondaryName, false, secondaryError);
        this.logOperation(secondaryName, this.taskType, isSecRateLimit ? "RATE_LIMIT" : "ERROR", fallbackEndTime - fallbackStartTime, secondaryError.message);
        
        throw new Error(`[AIRouter] All providers failed. Primary: ${primaryError.message}, Secondary: ${secondaryError.message}`);
      }
    }
  }

  async generateContent(prompt: string): Promise<string> {
    return this.executeWithFallback((provider) => provider.generateContent(prompt));
  }

  async analyzeNews(newsData: any): Promise<any> {
    return this.executeWithFallback((provider) => provider.analyzeNews(newsData));
  }
}

