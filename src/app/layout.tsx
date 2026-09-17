import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

export const metadata: Metadata = {
  title: "BordoMavi AI Editör",
  description: "AI Destekli BordoMavi İçerik Merkezi — Trabzonspor",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BordoMavi AI",
  },
  icons: {
    icon: "/assets/brand/bordomavi-logo.png",
    apple: "/assets/brand/bordomavi-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#781324" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
        {children}
        <PwaInstallPrompt />
        <Toaster />
      </body>
    </html>
  );
}
