import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SecurityClient } from "./SecurityClient";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.email) return redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) return redirect("/login");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Güvenlik</h1>
        <p className="text-muted-foreground">İki Aşamalı Doğrulama (2FA) ve hesap güvenliği.</p>
      </div>
      
      <div className="p-6 border rounded-xl bg-card shadow-sm">
        <SecurityClient is2FAEnabled={user.isTwoFactorEnabled} />
      </div>
    </div>
  );
}