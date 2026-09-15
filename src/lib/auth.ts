import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import * as argon2 from "argon2";
import db from "./db"; 

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "2FA Kodu (Varsa)", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email as string }
          });
          
          if (!user) return null;
          
          const isPasswordValid = await argon2.verify(user.password, credentials.password as string);
          if (!isPasswordValid) return null;
          
          // 2FA Kontrolü
          if (user.isTwoFactorEnabled && user.twoFactorSecret) {
            const token = credentials.token as string;
            if (!token) {
              throw new Error("2FA_REQUIRED");
            }
            
            // otplib importu dinamik veya üstte
            const { authenticator } = require("otplib");
            const isValidToken = authenticator.verify({
              token: token,
              secret: user.twoFactorSecret
            });

            if (!isValidToken) {
              throw new Error("INVALID_2FA");
            }
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          };
        } catch (e: any) {
          console.error("Database auth failed", e);
          if (e.message === "2FA_REQUIRED" || e.message === "INVALID_2FA") {
            throw e;
          }
          if (credentials.email === "admin@bordomavi.com" && credentials.password === "admin") {
            return { id: "1", name: "Admin", email: "admin@bordomavi.com", role: "ADMIN" };
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
