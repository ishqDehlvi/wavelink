import { site } from "@/lib/site";

/** Absolute URL on the site (schema.org wants absolute URLs everywhere). */
export const abs = (path = "/") => new URL(path, site.url).toString();

/** Stable @id anchors so pages can reference the same entities instead of repeating them. */
export const ids = {
  org: abs("/#organization"),
  author: abs("/#author"),
  website: abs("/#website"),
  app: abs("/#software"),
  source: abs("/#source-code"),
  film: abs("/#film"),
};

/** Serialise JSON-LD safely for a <script> tag. */
export const ldHtml = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

/** Entities every page shares: who makes Wavelink, and the site itself. */
export const siteGraph = () => [
  {
    "@type": "Organization",
    "@id": ids.org,
    name: site.name,
    url: abs("/"),
    logo: { "@type": "ImageObject", url: abs(site.logo), width: 512, height: 512 },
    description: site.description,
    founder: { "@id": ids.author },
    sameAs: [site.github, site.hackerNews],
  },
  {
    "@type": "Person",
    "@id": ids.author,
    name: site.author.name,
    url: site.author.url,
    sameAs: [site.author.github, site.author.hackerNews, site.author.url],
  },
  {
    "@type": "WebSite",
    "@id": ids.website,
    name: site.name,
    alternateName: "Wavelink WhatsApp MCP",
    url: abs("/"),
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": ids.org },
  },
];
