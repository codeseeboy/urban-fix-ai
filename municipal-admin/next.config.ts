import type { NextConfig } from "next";

// Backend the dashboard proxies /api to when it is not opened on localhost
// (rag-pc sets BACKEND_URL to its local API; Vercel falls back to Render).
const BACKEND_URL = process.env.BACKEND_URL || "https://urban-fix-ai.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
