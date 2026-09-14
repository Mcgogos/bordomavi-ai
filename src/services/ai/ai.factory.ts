import { AIProvider } from "./ai.provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { MockProvider } from "./mock.provider";
import { AIRouter, AITaskType } from "./ai.router";

export class AIFactory {
  static getProvider(name?: string): AIProvider {
    const providerName = name || process.env.AI_MODEL || "mock";
    
    if (providerName.includes("gemini")) {
      return new GeminiProvider();
    }
    
    return new MockProvider();
  }

  static getRouter(task: AITaskType): AIProvider {
    return new AIRouter(task);
  }
}
