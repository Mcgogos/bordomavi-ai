import SecurityClient from "./SecurityClient";

export const dynamic = 'force-dynamic';

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Güvenlik</h2>
        <p className="text-muted-foreground">Hesap güvenliğinizi ve şifrenizi yönetin.</p>
      </div>

      <SecurityClient />
    </div>
  );
}