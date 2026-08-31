import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node:sqlite is a Node built-in used only by server code; keep it external.
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default nextConfig;
