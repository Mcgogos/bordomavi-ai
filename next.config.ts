import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Netlify deployment (Vercel uses native build without standalone)
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  // Allow external images if needed
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.neon.tech" },
      { protocol: "https", hostname: "graph.facebook.com" },
    ],
  },
};

export default nextConfig;
