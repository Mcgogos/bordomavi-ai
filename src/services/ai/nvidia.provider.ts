import { AIProvider } from "./ai.provider.interface";

export class NvidiaProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";

  constructor() {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new Error("NVIDIA_API_KEY bulunamadi. Lutfen .env dosyasini kontrol edin.");
    }
    this.apiKey = apiKey;
    this.model = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";
  }

  async generateContent(prompt: string): Promise<string> {
    console.log(`[NvidiaProvider] Generating content using model: ${this.model}`);
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Status ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      
      if (!text) {
        throw new Error("AI returned empty content.");
      }

      return text.trim();
    } catch (error: any) {
      console.error("[NvidiaProvider] Detailed Error in generateContent:");
      console.error(JSON.stringify({
        message: error.message,
        model: this.model,
        endpoint: this.endpoint,
        keyConfig: "NVIDIA_API_KEY is configured (Length: " + (process.env.NVIDIA_API_KEY?.length || 0) + ")"
      }, null, 2));
      throw new Error(`NVIDIA API Error: ${error.message}`);
    }
  }

  async analyzeNews(newsData: any): Promise<any> {
    console.log(`[NvidiaProvider] Analyzing news using model: ${this.model}`);
    
    try {
      // NVIDIA NIM models are standard text/chat models. We prompt them to return JSON.
      const promptText = `Asagidaki Trabzonspor haberini analiz et ve SADECE gecerli bir JSON formatinda dondur. JSON disinda hicbir aciklama veya metin yazma (Markdown backtick kullanma, sadece saf JSON).
      
Haber Basligi: ${newsData.title}
Kaynak: ${newsData.sourceName || 'Bilinmiyor'}
Yayin Tarihi: ${newsData.publishedAt}
URL: ${newsData.url}
Aciklama/Icerik: ${newsData.summary || ''}

ONEMLI DEGERLENDIRME KRITERLERI (isTrabzonsporRelated):
- Haber dogrudan Trabzonspor hakkinda ise 'true' ver.
- Trabzonspor'un futbolcusu, teknik direktoru, yoneticisi, transferi, maci, kampi, sakatligi, kadrosu, kulup aciklamasi vb. Trabzonspor baglaminda ise 'true' ver.
- Sadece Trabzon sehriyle ilgiliyse (orn: trafik kazasi, yerel siyaset) 'false' ver.
- Sadece milli takim baglaminda Ugurcan Cakir, Eren Elmali vb. geciyorsa (Trabzonspor baglami yoksa) 'false' ver.
- Baska takim baglaminda Senol Gunes, Abdullah Avci, Fatih Tekke vb. geciyorsa 'false' ver.
- Sadece Super Lig haberi olup Trabzonspor ile gercek/dogrudan baglantisi yoksa 'false' ver.
- Belirsiz durumlarda 'false' tercih et.

Lutfen su JSON anahtarlarini (key) icerecek sekilde degerlendir:
- isTrabzonsporRelated: (boolean - true/false) Bu haber gercekten Trabzonspor ile mi ilgili?
- importanceScore: (0-100 arasi puan) Haber ne kadar onemli?
- credibilityScore: (0-100 arasi puan) Kaynak ne kadar guvenilir?
- trabzonsporRelevanceScore: (0-100 arasi puan) Haber gercekten Trabzonspor ile mi alakali?
- discussionPotentialScore: (0-100 arasi puan) Taraftarin ilgisini ceker mi?
- sharePotentialScore: (0-100 arasi puan) Paylasilma potansiyeli nedir?
- viralPotentialScore: (0-100 arasi puan) Viral olma potansiyeli nedir?
- recommendedContentType: (NEWS, COLUMN, POLL, NOSTALGIA, MATCH_PREVIEW, MATCH_REPORT, TRANSFER, PLAYER_ANALYSIS, MANAGEMENT_ANALYSIS, REELS_SCRIPT, FAN_CONTENT, QUESTION)
- recommendedAction: (IGNORE, MONITOR, CREATE_CONTENT, URGENT)
- shortSummary: Haberin kisa ozeti
- keyPoints: 3-5 maddelik onemli noktalar arrayi
- riskLevel: (LOW, MEDIUM, HIGH)
- confidence: (LOW, MEDIUM, HIGH)
`;

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: promptText }],
          temperature: 0.2,
          max_tokens: 1500
        }),
        // fetch timeout parameter requires an AbortController, handling it manually
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Status ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      let text = data.choices?.[0]?.message?.content;
      
      if (!text) {
        throw new Error("AI gecerli bir sonuc dondurmedi.");
      }

      // Temizleme (Markdown bloklarini kirp)
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      console.log("[Nvidia Result Sample]:", text.substring(0, 50) + "...");
      const result = JSON.parse(text);
      return result;
    } catch (error: any) {
      console.error("[NvidiaProvider] Detailed Error in analyzeNews:");
      console.error(JSON.stringify({
        message: error.message,
        model: this.model,
        endpoint: this.endpoint,
        keyConfig: "NVIDIA_API_KEY is configured (Length: " + (process.env.NVIDIA_API_KEY?.length || 0) + ")"
      }, null, 2));
      throw new Error(`NVIDIA API Error: ${error.message}`);
    }
  }
}
