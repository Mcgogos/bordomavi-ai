"use server";

import { revalidatePath } from "next/cache";

export async function saveSettingsAction(formData: FormData) {
  return { success: true, message: "Ayarlar kaydedildi." };
}

export async function testProviderAction(providerName: "gemini") {
  try {
    const provider = new (await import("@/services/ai/gemini.provider")).GeminiProvider();
    
    const startTime = Date.now();
    const result = await provider.generateContent(
      "Bana Trabzonspor hakkinda kisa bir slogan yaz.",
      null,
      "Sen bir test botusun."
    );
    const endTime = Date.now();

    return { 
      success: true, 
      time: endTime - startTime,
      result: result
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
