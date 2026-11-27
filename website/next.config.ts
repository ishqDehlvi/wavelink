import type { NextConfig } from "next";

// `npm run build:static` sets STATIC_EXPORT=1 for static hosts (Cloudflare Pages): plain files in out/.
// The Docker image keeps the standalone Node server.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
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
