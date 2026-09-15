process.env.AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "bordo-mavi-ai-editor-super-secret-key-development-2026-secure";

if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.includes("*")) {
  process.env.NEXTAUTH_URL = "https://bordomavi-ai-editor.netlify.app";
}
if (process.env.AUTH_URL && process.env.AUTH_URL.includes("*")) {
  process.env.AUTH_URL = "https://bordomavi-ai-editor.netlify.app";
}

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "./db";

class CustomAuthError extends CredentialsSignin {
  constructor(msg: string) {
    super();
    this.code = msg;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Kullanıcı Adı", type: "text" },
        password: { label: "Şifre", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        try {
          const normalizedEmail = (credentials.email as string).toLowerCase().trim();
          const user = await db.user.findUnique({
            where: { email: normalizedEmail }
          });
          
          if (!user) throw new CustomAuthError("Geçersiz kullanıcı adı veya şifre.");
          
          const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);
          if (!isPasswordValid) throw new CustomAuthError("Geçersiz kullanıcı adı veya şifre.");
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          };
        } catch (e: any) {
          console.error("Database auth failed", e);
          if (e instanceof CustomAuthError) {
            throw e;
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});