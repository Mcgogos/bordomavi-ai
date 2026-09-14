import { AIProvider } from "./ai.provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { OpenAIProvider } from "./openai.provider";
import { MockProvider } from "./mock.provider";
import { AIRouter, AITaskType } from "./ai.router";
import { NvidiaProvider } from "./nvidia.provider";

export class AIFactory {
  /**
   * Deprecated: Use getRouter(task) for robust fallback support and provider management.
   */
  static getProvider(name?: string): AIProvider {
    const providerName = name || process.env.AI_MODEL || "mock";
    
    if (providerName.includes("gpt")) {
      return new OpenAIProvider();
    }
    
    if (providerName.includes("gemini")) {
      return new GeminiProvider();
    }

    if (providerName.includes("nvidia")) {
      return new NvidiaProvider();
    }
    
    // Default or explicitly mock
    return new MockProvider();
  }

  /**
   * Yeni Mimari: Tüm AI işlemleri bu Router üzerinden geçer.
   */
  static getRouter(task: AITaskType): AIProvider {
    return new AIRouter(task);
  }
}
