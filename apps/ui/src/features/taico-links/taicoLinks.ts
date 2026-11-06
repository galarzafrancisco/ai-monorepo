/**
 * A task or context block in this Taico. The backend hands these links out as
 * `url` (apps/backend/src/config/app-links.ts); keep the paths in step.
 */
export type TaicoLinkKind = 'task' | 'block';
export type TaicoLinkRef = { kind: TaicoLinkKind; id: string };

const PATHS: Array<{ kind: TaicoLinkRef['kind']; pattern: RegExp }> = [
  { kind: 'task', pattern: /^\/tasks\/task\/([A-Za-z0-9-]+)\/?$/ },
  { kind: 'block', pattern: /^\/context\/block\/([A-Za-z0-9-]+)\/?$/ },
];

function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * The task or block a link points at, or null. Only links to this Taico count
 * (same origin, or a path like `/tasks/task/<id>`): a task in another Taico
 * can't be looked up here, so it stays a plain link.
 */
export function parseTaicoUrl(url: string, origin: string = currentOrigin()): TaicoLinkRef | null {
  const trimmed = url.trim();
  if (!origin) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed, origin);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== new URL(origin).origin) return null;
  // A relative link must be a path: "task/1" or "?x" are not links to a page here.
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) return null;
  for (const { kind, pattern } of PATHS) {
    const match = parsed.pathname.match(pattern);
    if (match) return { kind, id: match[1] };
  }
  return null;
}

/** The in-app route of a link this Taico serves, keeping its query and anchor. */
export function taicoRouteOf(url: string, origin: string = currentOrigin()): string {
  const parsed = new URL(url.trim(), origin);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function taicoLinkKey(ref: TaicoLinkRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** What a chip shows before the name has loaded, or when it can't be loaded. */
export function taicoFallbackLabel(ref: TaicoLinkRef): string {
  return `${ref.kind === 'task' ? 'Task' : 'Block'} ${ref.id.slice(0, 8)}`;
}
