"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(prevState: any, formData: FormData) {
  try {
    await signIn("credentials", formData, { redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.cause?.err?.message === "2FA_REQUIRED") {
        return "2FA_REQUIRED";
      }
      if (error.cause?.err?.message === "INVALID_2FA") {
        return "Geçersiz 2FA Kodu.";
      }
      switch (error.type) {
        case "CredentialsSignin":
          return "Geçersiz e-posta veya şifre.";
        default:
          return "Geçersiz giriş bilgileri veya hata oluştu.";
      }
    }
    throw error;
  }
}