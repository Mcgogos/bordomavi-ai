"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(prevState: any, formData: FormData) {
  try {
    await signIn("credentials", formData, { redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = error.cause?.err?.code || (error as any).code || error.type;
      
      if (code === "2FA_REQUIRED") {
        return "2FA_REQUIRED";
      }
      if (code === "INVALID_2FA") {
        return "Geçersiz 2FA Kodu.";
      }
      if (code === "Geçersiz e-posta veya şifre." || error.type === "CredentialsSignin") {
        return "Geçersiz e-posta veya şifre.";
      }
      return "Bir hata oluştu.";
    }
    throw error;
  }
}