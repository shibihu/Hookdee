import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pg-cloudflare"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
