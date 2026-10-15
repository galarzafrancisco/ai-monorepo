import { useEffect, useRef } from "react";

const MAX_SHOWN = 99;
/** The icon we draw the dot on. Same file index.html links as the 32px icon. */
const BASE_ICON_HREF = "/favicon-32x32.png";
const ICON_SIZE = 32;

function withCount(base: string, count: number): string {
  if (count <= 0) return base;
  const label = count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
  return `(${label}) ${base}`;
}

function iconLinks(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'));
}

/** Reads a color token from tokens.css so the dot follows the theme. */
function tokenColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draws the base favicon with a dot in the top-right corner. */
async function drawBadgedIcon(): Promise<string | null> {
  const img = await loadImage(BASE_ICON_HREF);
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
  const radius = ICON_SIZE * 0.22;
  const cx = ICON_SIZE - radius - 1;
  const cy = radius + 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = tokenColor("--danger", "red");
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = tokenColor("--bg", "white");
  ctx.stroke();
  return canvas.toDataURL("image/png");
}

/**
 * Shows unread threads on the browser tab, like a messaging app does:
 * the title gets a "(N) " prefix and the favicon gets a dot.
 *
 * Pages set `document.title` on their own (see useDocumentTitle), so the
 * prefix is re-applied whenever the title changes instead of owning it.
 */
export function useTabUnreadIndicator(unreadThreadCount: number) {
  // We remember the exact title we wrote. If document.title still equals it,
  // the prefix is ours and `base` holds the page's own title. Anything else is
  // a fresh title from the app and is taken as-is, so app titles that happen
  // to start with "(N) " are never stripped.
  const titleState = useRef<{ base: string; applied: string | null }>({
    base: document.title,
    applied: null,
  });

  // Title prefix: apply now, and again whenever a page rewrites the title.
  useEffect(() => {
    const state = titleState.current;
    const apply = () => {
      const current = document.title;
      if (current !== state.applied) state.base = current;
      const next = withCount(state.base, unreadThreadCount);
      state.applied = next;
      if (next !== current) document.title = next;
    };
    apply();

    let titleEl = document.querySelector("title");
    if (!titleEl) {
      titleEl = document.createElement("title");
      document.head.appendChild(titleEl);
    }
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [unreadThreadCount]);

  // Drop the prefix when the indicator goes away (e.g. logout), but only if
  // the title is still the one we wrote.
  useEffect(() => {
    const state = titleState.current;
    return () => {
      if (state.applied !== null && document.title === state.applied) {
        document.title = state.base;
      }
      state.applied = null;
    };
  }, []);

  // Favicon dot.
  const hasUnread = unreadThreadCount > 0;
  useEffect(() => {
    const links = iconLinks();
    if (links.length === 0) return;
    const originals = links.map((link) => link.getAttribute("href"));
    const restore = () =>
      links.forEach((link, i) => {
        const href = originals[i];
        if (href) link.setAttribute("href", href);
      });

    if (!hasUnread) return;

    let cancelled = false;
    drawBadgedIcon()
      .then((dataUrl) => {
        if (cancelled || !dataUrl) return;
        links.forEach((link) => link.setAttribute("href", dataUrl));
      })
      .catch(() => {
        // Icon failed to load; the title prefix still shows the count.
      });

    return () => {
      cancelled = true;
      restore();
    };
  }, [hasUnread]);
}
