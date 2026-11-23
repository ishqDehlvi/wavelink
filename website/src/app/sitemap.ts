import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { allDocRoutes } from "@/lib/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/docs`, changeFrequency: "weekly", priority: 0.8 },
    ...allDocRoutes().map((r) => ({
      url: `${site.url}${r}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
