"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  try {
    const session = await auth();
    if (!session?.user?.email) return { success: false, error: "Yetkisiz erişim" };

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    
    if (!user) return { success: false, error: "Kullanıcı bulunamadı" };

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return { success: false, error: "Mevcut şifreniz yanlış." };

    const newHash = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: newHash }
    });

    return { success: true };
  } catch (e: any) {
    console.error("Change password error:", e);
    return { success: false, error: "Sunucu hatası oluştu." };
  }
}