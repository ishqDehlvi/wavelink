export type NavItem = { slug: string; title: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Sidebar order. `slug` is the route under /docs ("" is the index, "deploy" is deploy/README.md). */
export const docsNav: NavGroup[] = [
  {
    title: "Start here",
    items: [
      { slug: "quickstart", title: "Quick start" },
      { slug: "configuration", title: "Configuration" },
      { slug: "troubleshooting", title: "Troubleshooting" },
      { slug: "demo-mode", title: "Demo mode" },
    ],
  },
  {
    title: "Connect",
    items: [
      { slug: "connect/chatgpt", title: "ChatGPT" },
      { slug: "connect/claude", title: "Claude" },
      { slug: "connect/other-clients", title: "Cursor and other clients" },
      { slug: "mcp-tools", title: "MCP tools reference" },
    ],
  },
  {
    title: "Deploy",
    items: [
      { slug: "deploy", title: "Choosing a platform" },
      { slug: "deploy/docker", title: "Docker Compose" },
      { slug: "deploy/lightsail", title: "AWS Lightsail" },
      { slug: "deploy/vps", title: "Ubuntu VPS" },
      { slug: "deploy/railway", title: "Railway" },
      { slug: "deploy/fly", title: "Fly.io" },
      { slug: "deploy/render", title: "Render" },
    ],
  },
  {
    title: "Understand",
    items: [
      { slug: "architecture", title: "Architecture" },
      { slug: "dashboard", title: "Dashboard" },
      { slug: "accounts", title: "Accounts and the superadmin" },
      { slug: "security", title: "Security model" },
    ],
  },
];

export const flatNav: NavItem[] = [{ slug: "", title: "Documentation" }, ...docsNav.flatMap((g) => g.items)];
