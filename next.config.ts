import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Netlify deployment
  output: "standalone",

  // Allow external images if needed
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.neon.tech" },
      { protocol: "https", hostname: "graph.facebook.com" },
    ],
  },
};

export default nextConfig;
