export const dynamic = 'force-dynamic';
import { getNewsSources } from "./actions";
import SettingsClient from "./SettingsClient";
import AiProvidersSettings from "./AiProvidersSettings";
import FacebookSettings from "./FacebookSettings";

export default async function SettingsPage() {
  const sources = await getNewsSources();

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground mt-1">Sistem ve Haber Kaynakları ayarlarını yönetin.</p>
      </div>

      <FacebookSettings />
      <AiProvidersSettings />
      <SettingsClient initialSources={sources} />
    </div>
  );
}