import { AIProvider } from "./ai.provider.interface";
import { NvidiaProvider } from "./nvidia.provider";
import { MockProvider } from "./mock.provider";
import { AIRouter, AITaskType } from "./ai.router";

export class AIFactory {
  static getProvider(name?: string): AIProvider {
    const providerName = name || process.env.AI_MODEL || "nvidia";
    
    if (providerName === "mock") {
      return new MockProvider();
    }
    
    return new NvidiaProvider();
  }

  static getRouter(task: AITaskType): AIProvider {
    return new AIRouter(task);
  }
}

