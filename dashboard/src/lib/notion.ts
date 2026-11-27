// Notion types and helpers. All calls go through /api/wa/notion/* (the service checks every permission again).
export const PERMS = ["read", "edit", "create", "comment", "archive"] as const;
export type Perm = (typeof PERMS)[number];
export type Perms = Record<Perm, boolean>;

export const PERM_LABEL: Record<Perm, string> = {
  read: "Read",
  edit: "Edit",
  create: "Create",
  comment: "Comment",
  archive: "Archive",
};
export const PERM_HELP: Record<Perm, string> = {
  read: "See the page, its content, rows and comments",
  edit: "Rename it, change properties and add content",
  create: "Add sub-pages, or rows in a database",
  comment: "Leave comments",
  archive: "Move it to Notion's trash",
};

export type NotionStatus = {
  connected: boolean;
  canManage: boolean;
  oauthAvailable: boolean;
  redirectUri?: string;
  workspace?: { name: string | null; icon: string | null };
  kind?: "oauth" | "token";
  connectedBy?: string;
  connectedAt?: number;
  lastSync?: number | null;
  syncing?: boolean;
  syncError?: string | null;
  pages?: number;
};

export type NotionPage = {
  id: string;
  kind: "page" | "database";
  title: string;
  icon: string | null;
  url: string | null;
  parentId: string | null;
  lastEdited: number | null;
  perms: Perms;
};

export type Span = { t: string; b?: 1; i?: 1; c?: 1; s?: 1; href?: string };
export type Block = {
  id: string;
  type: string;
  text?: Span[];
  checked?: boolean;
  language?: string;
  icon?: string | null;
  title?: string;
  pageId?: string;
  url?: string | null;
  cells?: Span[][];
  children?: Block[];
};

export type Column = { name: string; type: string; options: string[] };
export type Row = { id: string; title: string; url: string | null; icon: string | null; cells: Record<string, string> };

export type PageDetail = NotionPage & {
  breadcrumbs: { id: string; title: string; icon: string | null }[];
  properties?: Record<string, string> | null;
  blocks?: Block[];
  comments?: { id: string; text: string; created: string }[];
  children?: NotionPage[];
  database?: { columns: Column[]; rows: Row[]; nextCursor: string | null };
};

export type AccessMatrix = {
  users: { id: string; username: string; name: string | null; role: "superadmin" | "user" }[];
  pages: { id: string; kind: "page" | "database"; title: string; icon: string | null; parentId: string | null }[];
  grants: ({ userId: string; pageId: string; updated: number; updatedBy: string | null } & Perms)[];
};

export type Activity = { username: string; action: string; pageId: string | null; title: string | null; via: "dashboard" | "chatgpt"; ts: number };

export const NONE: Perms = { read: false, edit: false, create: false, comment: false, archive: false };

/** Same rule as the service: the nearest page (itself or an ancestor) with its own setting wins. */
export function effectiveFor(userId: string, pageId: string, m: AccessMatrix) {
  const parent = new Map(m.pages.map((p) => [p.id, p.parentId]));
  const own = new Map(m.grants.filter((g) => g.userId === userId).map((g) => [g.pageId, g]));
  let id: string | null | undefined = pageId;
  for (let hops = 0; id && hops < 60; hops++) {
    const g = own.get(id);
    if (g) {
      const perms = Object.fromEntries(PERMS.map((k) => [k, g[k]])) as Perms;
      return { perms, from: id, explicit: id === pageId };
    }
    id = parent.get(id);
  }
  return { perms: NONE, from: null as string | null, explicit: false };
}

/** Pages as a tree: children of each id (null = top level), sorted by title. */
export function treeOf<T extends { id: string; parentId: string | null; title: string }>(pages: T[]) {
  const ids = new Set(pages.map((p) => p.id));
  const kids = new Map<string | null, T[]>();
  for (const p of pages) {
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    (kids.get(key) ?? kids.set(key, []).get(key)!).push(p);
  }
  for (const list of kids.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  return kids;
}
