"use server";

import { AIFactory } from "@/services/ai/ai.factory";

export async function generateStrategyAction() {
  try {
    // Burada MockProvider'ı zorluyoruz (kullanıcı talebi)
    const aiProvider = AIFactory.getRouter("SUMMARY");
    
    // MockProvider kullanarak "Strateji üret" gibi bir komut yollayalım. 
    // MockProvider'ın generateContent'i sadece rastgele bir string veya JSON string dönecektir.
    const result = await aiProvider.generateContent("Bana önümüzdeki 7 gün için Trabzonspor içerik stratejisi önerileri ver.");

    // Gerçekte Gemini'den dönseydi JSON olabilirdi, ama mock provider basit bir metin döner.
    // Biz burada UI'da göstereceğimiz "Mock" stratejileri sabit olarak döndürelim (Mock Provider'ın delay etkisini kullanmış oluyoruz).
    
    return { 
      success: true, 
      data: [
        {
          title: "Maç Günü Atmosferi",
          description: "Taraftarın stadyum çevresindeki heyecanını maçtan 3 saat önce kısa videolarla (Reels/Shorts) paylaş.",
          impact: "Yüksek Etkileşim"
        },
        {
          title: "Nostalji Salısı",
          description: "Salı günleri eski şampiyonluklardan veya unutulmaz maçlardan kesitler paylaşarak organik erişimi artır.",
          impact: "Orta-Yüksek"
        },
        {
          title: "Transfer Dedikodusu Anketi",
          description: "Twitter (X) üzerinde 'Sizce orta sahaya kim alınmalı?' gibi anketler düzenleyerek etkileşim oranını %30 artır.",
          impact: "Yüksek Tartışma"
        }
      ]
    };
  } catch (error: any) {
    console.error("[StrategyAction] Error:", error);
    return { success: false, error: error.message || "Strateji oluşturulurken bir hata meydana geldi." };
  }
}
