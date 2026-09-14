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
        setGeminiResult(res.success ? \? Gemini API baðlantýsý baþarýlý\nModel: gemini-3.1-flash-lite\nResponse time: \ms\ : \? Gemini API baðlantýsý baþarýsýz\nHata: \\);
      }
    } catch (e: any) {
      setGeminiResult(\? Hata: \\);
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
              <CardDescription>Ana içerik üretimi ve haber analizi (gemini-3.1-flash-lite)</CardDescription>
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
            <div className={\	ext-sm p-3 rounded-md whitespace-pre-wrap \\}>
              {geminiResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
