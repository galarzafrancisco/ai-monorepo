/**
 * Keeps every tab on the workspace its session is in.
 *
 * Session cookies are shared by all tabs, so switching workspace in one tab
 * moves every tab's session. A tab still showing the old workspace must not
 * keep working: its next request would read or write in the new workspace
 * while the page shows the old one. Three things stop that:
 *
 * 1. Every same-origin API request says which workspace the page shows
 *    (`x-taico-workspace`). The backend refuses it with `WORKSPACE_CHANGED`
 *    (409) when the session is in another workspace, and the page reloads.
 * 2. A tab that switches tells the others (BroadcastChannel); they reload.
 * 3. A tab coming back to the foreground re-checks the session, so tabs that
 *    were asleep and missed the message reload before anyone types in them.
 */
import { WorkspacesService } from './api';

export const EXPECTED_WORKSPACE_HEADER = 'x-taico-workspace';
const WORKSPACE_CHANGED = 'WORKSPACE_CHANGED';
const CHANNEL_NAME = 'taico-workspace-session';

type SwitchMessage = { type: 'switched'; workspaceId: string };

let shownWorkspaceId: string | null = null;

/** Records the workspace this page shows; API requests carry it from now on. */
export function setShownWorkspace(workspaceId: string | null): void {
  shownWorkspaceId = workspaceId;
}

/** The workspace this page shows, or null until it is pinned. */
export function getShownWorkspace(): string | null {
  return shownWorkspaceId;
}

export function reloadPage(): void {
  window.location.reload();
}

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
}

/** Tells the other tabs the session is now in `workspaceId`. */
export function announceWorkspaceSwitch(workspaceId: string): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage({ type: 'switched', workspaceId } satisfies SwitchMessage);
  channel.close();
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(href, window.location.href);
  } catch {
    return null;
  }
}

function isApiRequest(input: RequestInfo | URL): boolean {
  const url = requestUrl(input);
  return !!url && url.origin === window.location.origin && url.pathname.startsWith('/api/');
}

async function isWorkspaceChanged(response: Response): Promise<boolean> {
  if (response.status !== 409) return false;
  try {
    const body = (await response.clone().json()) as { code?: unknown } | null;
    return body?.code === WORKSPACE_CHANGED;
  } catch {
    return false;
  }
}

/**
 * Starts the guard for this page. Returns a function that stops it (used by
 * tests and on unmount).
 */
export function startWorkspaceSessionGuard(): () => void {
  const originalFetch = window.fetch;

  const guardedFetch: typeof window.fetch = async (input, init) => {
    const expected = shownWorkspaceId;
    if (!expected || !isApiRequest(input)) {
      return originalFetch(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(EXPECTED_WORKSPACE_HEADER, expected);
    const response = await originalFetch(input, { ...init, headers });
    if (await isWorkspaceChanged(response)) {
      reloadPage();
    }
    return response;
  };
  window.fetch = guardedFetch;

  const channel = openChannel();
  if (channel) {
    channel.onmessage = (event: MessageEvent<SwitchMessage>) => {
      if (event.data?.type === 'switched' && event.data.workspaceId !== shownWorkspaceId) {
        reloadPage();
      }
    };
  }

  // A 409 on this request reloads the page through the fetch guard.
  const recheck = () => {
    if (document.visibilityState !== 'visible' || !shownWorkspaceId) return;
    WorkspacesService.workspaceAdminControllerGetCurrent().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('focus', recheck);

  return () => {
    if (window.fetch === guardedFetch) window.fetch = originalFetch;
    channel?.close();
    document.removeEventListener('visibilitychange', recheck);
    window.removeEventListener('focus', recheck);
  };
}
