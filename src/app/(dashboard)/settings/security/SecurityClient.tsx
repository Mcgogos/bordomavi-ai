"use client";

import { useState } from "react";
import { generate2FASecretAction, verifyAndEnable2FAAction, disable2FAAction } from "./actions";
import { Shield, ShieldAlert, Loader2, QrCode } from "lucide-react";
import { toast } from "react-hot-toast";

export function SecurityClient({ is2FAEnabled }: { is2FAEnabled: boolean }) {
  const [setupData, setSetupData] = useState<{ secret: string, qrCodeUrl: string } | null>(null);
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStartSetup = async () => {
    setIsLoading(true);
    const res = await generate2FASecretAction();
    if (res.success) {
      setSetupData({ secret: res.secret!, qrCodeUrl: res.qrCodeUrl! });
    } else {
      toast.error("Hata oluþtu.");
    }
    setIsLoading(false);
  };

  const handleVerify = async () => {
    if (!setupData || token.length !== 6) return;
    setIsLoading(true);
    const res = await verifyAndEnable2FAAction(setupData.secret, token);
    if (res.success) {
      toast.success("2FA baþarýyla aktif edildi!");
      setSetupData(null);
    } else {
      toast.error(res.error || "Doðrulama baþarýsýz.");
    }
    setIsLoading(false);
  };

  const handleDisable = async () => {
    if (!confirm("2FA'yý devre dýþý býrakmak istediðinize emin misiniz?")) return;
    setIsLoading(true);
    const res = await disable2FAAction();
    if (res.success) {
      toast.success("2FA devre dýþý býrakýldý.");
    } else {
      toast.error("Hata oluþtu.");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {is2FAEnabled ? (
          <Shield className="w-8 h-8 text-green-500" />
        ) : (
          <ShieldAlert className="w-8 h-8 text-amber-500" />
        )}
        <div>
          <h3 className="text-lg font-medium">Ýki Aþamalý Doðrulama (2FA)</h3>
          <p className="text-sm text-muted-foreground">
            {is2FAEnabled 
              ? "Hesabýnýz ekstra güvende. Giriþ yaparken Authenticator kodu istenecektir."
              : "Hesabýnýz risk altýnda. Hemen Google Authenticator ile korumaya alýn."}
          </p>
        </div>
      </div>

      {!is2FAEnabled && !setupData && (
        <button 
          onClick={handleStartSetup}
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 flex items-center"
        >
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
          Kuruluma Baþla
        </button>
      )}

      {is2FAEnabled && (
        <button 
          onClick={handleDisable}
          disabled={isLoading}
          className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded hover:bg-destructive/20 disabled:opacity-50"
        >
          2FA'yý Devre Dýþý Býrak
        </button>
      )}

      {setupData && (
        <div className="mt-6 p-6 border rounded-lg bg-muted/20 space-y-4">
          <h4 className="font-medium">1. Uygulamayý Ýndirin</h4>
          <p className="text-sm text-muted-foreground">Google Authenticator veya Authy uygulamasýný açýn.</p>
          
          <h4 className="font-medium mt-4">2. QR Kodu Okutun</h4>
          <div className="bg-white p-2 inline-block rounded-md">
            <img src={setupData.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
          </div>

          <h4 className="font-medium mt-4">3. Kodu Girin</h4>
          <p className="text-sm text-muted-foreground">Uygulamada gözüken 6 haneli þifreyi girin:</p>
          <div className="flex gap-2 max-w-xs">
            <input 
              type="text" 
              maxLength={6}
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full p-2 text-center text-xl tracking-widest border rounded bg-background" 
            />
            <button 
              onClick={handleVerify}
              disabled={token.length !== 6 || isLoading}
              className="px-4 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              Doðrula
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
