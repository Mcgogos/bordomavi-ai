export const dynamic = 'force-dynamic';
import { getNewsSources } from "./actions";
import SettingsClient from "./SettingsClient";
import AiProvidersSettings from "./AiProvidersSettings";
import FacebookSettings from "./FacebookSettings";

export default async function SettingsPage() {
  const sources = await getNewsSources();

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sistem Ayarları</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Yapılandırma
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Facebook Graph API bağlantısı, Gemini AI servisleri ve otomatik RSS haber kaynaklarını yönetin.
        </p>
      </div>

      <FacebookSettings />
      <AiProvidersSettings />
      <SettingsClient initialSources={sources} />
    </div>
  );
}