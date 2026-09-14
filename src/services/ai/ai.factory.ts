import { AIProvider } from "./ai.provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { MockProvider } from "./mock.provider";

export class AIFactory {
  static getProvider(providerName?: string): AIProvider {
    if (!providerName) {
      providerName = process.env.AI_MODEL || "gemini-3.1-flash-lite";
    }

    if (providerName.includes("mock") || providerName.includes("test")) {
      return new MockProvider();
    }

    // Her durumda Gemini dondur
    return new GeminiProvider();
  }
}
