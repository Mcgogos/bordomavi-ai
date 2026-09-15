"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";

export async function generate2FASecretAction() {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Unauthorized" };

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(session.user.email, "BordoMavi Editor", secret);
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return { success: true, secret, qrCodeUrl };
}

export async function verifyAndEnable2FAAction(secret: string, token: string) {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Unauthorized" };

  const isValid = authenticator.verify({ token, secret });
  if (!isValid) return { success: false, error: "Geçersiz kod." };

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      isTwoFactorEnabled: true,
      twoFactorSecret: secret,
    }
  });
  
  revalidatePath("/settings/security");
  return { success: true };
}

export async function disable2FAAction() {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Unauthorized" };

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
    }
  });
  
  revalidatePath("/settings/security");
  return { success: true };
}