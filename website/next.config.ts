import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Docs are read from ../docs at build time; make sure the standalone bundle traces them.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/tools", destination: "/docs/mcp-tools", permanent: false },
      { source: "/deploy", destination: "/docs/deploy", permanent: false },
    ];
  },
};

export default nextConfig;
