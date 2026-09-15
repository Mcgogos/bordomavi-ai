"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(prevState: any, formData: FormData) {
  try {
    await signIn("credentials", formData, { redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error.cause?.err as any)?.code || (error as any).code || error.type;
      
      if (code === "Geçersiz kullanıcı adı veya şifre." || error.type === "CredentialsSignin") {
        return "Geçersiz kullanıcı adı veya şifre.";
      }
      return "Bir hata oluştu.";
    }
    throw error;
  }
}