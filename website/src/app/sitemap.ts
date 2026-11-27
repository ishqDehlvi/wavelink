import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { allDocRoutes } from "@/lib/docs";
import { allPosts } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...allPosts().map((p) => ({
      url: `${site.url}/blog/${p.slug}`,
      lastModified: p.updated ?? p.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${site.url}/docs`, changeFrequency: "weekly", priority: 0.8 },
    ...allDocRoutes().map((r) => ({
      url: `${site.url}${r}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
