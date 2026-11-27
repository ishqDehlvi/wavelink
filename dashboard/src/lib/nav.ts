"use client";

// Where the person has been in this tab, so Back returns to the page they came from (not just "up one level").
// Kept in sessionStorage: one stack per tab, gone when the tab closes.
const KEY = "wl_nav";

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-50)));
  } catch {}
}

/** Call on every page change. Going back to the previous entry pops; anything else pushes. */
export function recordVisit(url: string) {
  const stack = read();
  if (stack[stack.length - 1] === url) return;
  if (stack[stack.length - 2] === url) stack.pop();
  else stack.push(url);
  write(stack);
}

/** True when the browser's previous entry is a page of this dashboard. */
export function canGoBack() {
  return read().length > 1;
}
