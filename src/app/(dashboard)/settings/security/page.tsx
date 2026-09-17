import SecurityClient from "./SecurityClient";

export const dynamic = 'force-dynamic';

export default function SecurityPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hesap ve Güvenlik</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Erişim Kontrolü
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Yönetici hesap güvenliğinizi ve şifreleme parametrelerinizi yönetin.
        </p>
      </div>

      <SecurityClient />
    </div>
  );
}