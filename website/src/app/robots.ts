import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Search engines and AI answer engines are all welcome: the site is public docs and marketing for an open-source project.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/md/" }, { userAgent: AI_CRAWLERS, allow: "/", disallow: "/md/" }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
