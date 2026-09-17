"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed / standalone
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt if not dismissed previously in this session
      const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Show for iOS after 3 seconds if not dismissed
    if (isIosDevice) {
      const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => setIsVisible(true), 3000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (isInstalled || !isVisible) return null;

  return (
    <aside aria-label="Mobil Uygulama Yükleme" className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-card border border-border/90 rounded-2xl p-4 shadow-xl backdrop-blur-xl bg-card/95 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#781324] to-[#164E7A] flex items-center justify-center text-white shrink-0 shadow-sm">
          <Smartphone className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-bold text-foreground">BordoMavi AI Uygulaması</h4>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {isIOS 
              ? "Telefonunuza yüklemek için tarayıcıda Paylaş ikonuna dokunup 'Ana Ekrana Ekle'yi seçin."
              : "Platformu telefonunuza veya masaüstünüze tek tıkla yükleyin ve hızlıca erişin."
            }
          </p>

          {!isIOS && deferredPrompt && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="h-8 text-xs font-semibold bg-[#781324] hover:bg-[#5e0e1c] text-white"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Uygulamayı Yükle
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 text-xs text-muted-foreground"
              >
                Daha Sonra
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
