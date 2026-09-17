"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { testProviderAction } from "./actions";

export default function AiProvidersSettings() {
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);

  const handleTest = async (provider: "gemini") => {
    setTestingGemini(true);
    setGeminiResult(null);

    try {
      const res = await testProviderAction(provider);
      if (provider === "gemini") {
        setGeminiResult(res.success ? `SUCCESS Gemini API baglantisi basarili\nResponse time: ${res.time}ms` : `ERROR Gemini API baglantisi basarisiz\nHata: ${res.error}`);
      }
    } catch (e: any) {
      setGeminiResult(`ERROR Hata: ${e.message}`);
    } finally {
      setTestingGemini(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">Google Gemini Yapay Zeka Servisi</CardTitle>
              <CardDescription className="text-xs">
                Ana editoryal içerik üretimi, dil modeli ve önem skoru analizi (Gemini Flash)
              </CardDescription>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              API Aktif
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <Button 
            variant="outline" 
            size="sm"
            disabled={testingGemini}
            onClick={() => handleTest("gemini")}
            className="h-8 text-xs font-semibold border-border/80"
          >
            {testingGemini ? "Bağlantı Test Ediliyor..." : "Gemini API Bağlantısını Test Et"}
          </Button>

          {geminiResult && (
            <div className={`text-xs p-3.5 rounded-xl border whitespace-pre-wrap leading-relaxed font-mono ${
              geminiResult.includes('SUCCESS') 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
            }`}>
              {geminiResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

