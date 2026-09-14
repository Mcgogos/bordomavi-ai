"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { testProviderAction } from "./actions"; // We will create this

export default function AiProvidersSettings() {
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingNvidia, setTestingNvidia] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [nvidiaResult, setNvidiaResult] = useState<string | null>(null);

  const handleTest = async (provider: "gemini" | "nvidia") => {
    if (provider === "gemini") setTestingGemini(true);
    if (provider === "nvidia") setTestingNvidia(true);

    try {
      const res = await testProviderAction(provider);
      if (provider === "gemini") {
        setGeminiResult(res.success ? `✓ Gemini API bağlantısı başarılı\nResponse time: ${res.time}ms` : `✕ Gemini API bağlantısı başarısız\nHata: ${res.error}`);
      } else {
        setNvidiaResult(res.success ? `✓ NVIDIA API bağlantısı başarılı\nModel: meta/llama-3.1-70b-instruct\nResponse time: ${res.time}ms` : `✕ NVIDIA API bağlantısı başarısız\nHata: ${res.error}`);
      }
    } catch (e: any) {
      if (provider === "gemini") setGeminiResult(`✕ Hata: ${e.message}`);
      if (provider === "nvidia") setNvidiaResult(`✕ Hata: ${e.message}`);
    } finally {
      if (provider === "gemini") setTestingGemini(false);
      if (provider === "nvidia") setTestingNvidia(false);
    }
  };

  return (
    <Card className="border-border bg-card mt-6">
      <CardHeader>
        <CardTitle>AI Providers</CardTitle>
        <CardDescription>Yapay Zeka sağlayıcılarının durumunu görüntüleyin ve bağlantıları test edin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* GEMINI */}
        <div className="border rounded-lg p-4 bg-muted/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Gemini <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">API Key: ••••••••••••••••</p>
              <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div>Varsayılan Model: <span className="text-foreground">gemini-3.5-flash-lite</span></div>
                <div>Öncelik: <span className="text-foreground">Yüksek (FACEBOOK_POST, EDITORIAL_REVIEW)</span></div>
                <div>Fallback: <span className="text-foreground">Aktif</span></div>
                <div>Durum: <span className="text-foreground">AKTİF</span></div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              disabled={testingGemini}
              onClick={() => handleTest("gemini")}
            >
              {testingGemini ? "Test Ediliyor..." : "API TEST ET"}
            </Button>
          </div>
          {geminiResult && (
            <div className={`text-sm p-3 rounded-md whitespace-pre-wrap ${geminiResult.includes('✓') ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {geminiResult}
            </div>
          )}
        </div>

        {/* NVIDIA */}
        <div className="border rounded-lg p-4 bg-muted/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                NVIDIA <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">API Key: ••••••••••••••••</p>
              <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div>Varsayılan Model: <span className="text-foreground">meta/llama-3.1-70b-instruct</span></div>
                <div>Öncelik: <span className="text-foreground">Yüksek (NEWS_ANALYSIS, SUMMARY)</span></div>
                <div>Fallback: <span className="text-foreground">Aktif</span></div>
                <div>Durum: <span className="text-foreground">AKTİF</span></div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              disabled={testingNvidia}
              onClick={() => handleTest("nvidia")}
            >
              {testingNvidia ? "Test Ediliyor..." : "API TEST ET"}
            </Button>
          </div>
          {nvidiaResult && (
            <div className={`text-sm p-3 rounded-md whitespace-pre-wrap ${nvidiaResult.includes('✓') ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {nvidiaResult}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
