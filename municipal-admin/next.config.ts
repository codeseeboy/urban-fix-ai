import type { NextConfig } from "next";

// Backend the dashboard proxies /api to when it is not opened on localhost.
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
