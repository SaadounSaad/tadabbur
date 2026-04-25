import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow reading system-prompt.md and tafsir files from filesystem
  serverExternalPackages: [],
  // Enable standalone output for Docker deployment
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
};

export default nextConfig;
