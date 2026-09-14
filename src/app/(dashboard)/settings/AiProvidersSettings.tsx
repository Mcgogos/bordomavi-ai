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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Google Gemini API</CardTitle>
              <CardDescription>Ana icerik uretimi ve haber analizi (gemini-3.1-flash-lite)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            size="sm"
            disabled={testingGemini}
            onClick={() => handleTest("gemini")}
          >
            {testingGemini ? "Test Ediliyor..." : "API TEST ET"}
          </Button>

          {geminiResult && (
            <div className={`text-sm p-3 rounded-md whitespace-pre-wrap ${geminiResult.includes('SUCCESS') ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {geminiResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

