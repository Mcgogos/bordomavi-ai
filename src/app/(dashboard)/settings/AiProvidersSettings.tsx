"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { testProviderAction } from "./actions";

export default function AiProvidersSettings() {
  const [testingNvidia, setTestingNvidia] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    setTestingNvidia(true);
    setTestResult(null);

    try {
      const res = await testProviderAction();
      setTestResult(
        res.success 
          ? `✅ BAŞARILI: NVIDIA NIM / Açık Kaynak AI motoru devrede!\nModel Yanıtı: "${res.result}"\nYanıt Süresi: ${res.time}ms` 
          : `❌ HATA: Bağlantı kurulamadı: ${res.error}`
      );
    } catch (e: any) {
      setTestResult(`❌ HATA: ${e.message}`);
    } finally {
      setTestingNvidia(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">NVIDIA NIM & Açık Kaynak Yapay Zeka Motoru</CardTitle>
              <CardDescription className="text-xs">
                Llama 3.2 11B Vision, Nemotron-3 Super 120B/550B ve OpenRouter Yük Dengeleme Ağı (Gemini API kotası harcanmaz)
              </CardDescription>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              NVIDIA NIM Aktif
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <Button 
            variant="outline" 
            size="sm"
            disabled={testingNvidia}
            onClick={handleTest}
            className="h-8 text-xs font-semibold border-border/80"
          >
            {testingNvidia ? "NVIDIA Motoru Test Ediliyor..." : "NVIDIA NIM Bağlantısını Test Et"}
          </Button>

          {testResult && (
            <div className={`text-xs p-3.5 rounded-xl border whitespace-pre-wrap leading-relaxed font-mono ${
              testResult.includes('BAŞARILI') 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
            }`}>
              {testResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

