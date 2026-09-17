"use server";

import { MatchAutomationEngine, MatchEventParams } from "@/lib/matchday/match-engine";
import { revalidatePath } from "next/cache";

export async function publishMatchEventAction(params: MatchEventParams) {
  try {
    const result = await MatchAutomationEngine.publishMatchEventDirectly(params);
    revalidatePath("/matchday");
    revalidatePath("/content");
    return result;
  } catch (error: any) {
    console.error("[Match Action Error]:", error);
    return { success: false, error: error.message || "Yayınlama başarısız oldu.", message: "Yayınlama hatası" };
  }
}