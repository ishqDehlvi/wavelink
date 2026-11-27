import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name}: ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#0e9f67",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: site.logo, type: "image/png", sizes: "512x512" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}

export const dynamic = "force-static";
