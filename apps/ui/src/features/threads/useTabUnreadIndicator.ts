import { useEffect } from "react";

/** Matches a count prefix we added earlier, e.g. "(3) " or "(99+) ". */
const COUNT_PREFIX = /^\(\d+\+?\) /;
const MAX_SHOWN = 99;
/** The icon we draw the dot on. Same file index.html links as the 32px icon. */
const BASE_ICON_HREF = "/favicon-32x32.png";
const ICON_SIZE = 32;

function stripCount(title: string): string {
  return title.replace(COUNT_PREFIX, "");
}

function withCount(title: string, count: number): string {
  const base = stripCount(title);
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
  // Title prefix: apply now, and again whenever a page rewrites the title.
  useEffect(() => {
    const apply = () => {
      const next = withCount(document.title, unreadThreadCount);
      if (next !== document.title) document.title = next;
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

  // Drop the prefix when the indicator goes away (e.g. logout).
  useEffect(() => {
    return () => {
      document.title = stripCount(document.title);
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
