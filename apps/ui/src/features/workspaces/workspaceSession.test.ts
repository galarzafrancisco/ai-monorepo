// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  WorkspacesService: { workspaceAdminControllerGetCurrent: vi.fn() },
}));

import { WorkspacesService } from './api';
import {
  announceWorkspaceSwitch,
  EXPECTED_WORKSPACE_HEADER,
  setShownWorkspace,
  startWorkspaceSessionGuard,
} from './workspaceSession';

const reload = vi.fn();
let backendFetch: ReturnType<typeof vi.fn>;
let stop: () => void;

function changedResponse() {
  return new Response(JSON.stringify({ code: 'WORKSPACE_CHANGED' }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  reload.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, href: 'http://localhost/tasks', origin: 'http://localhost', reload },
  });
  backendFetch = vi.fn(async () => new Response('{}', { status: 200 }));
  window.fetch = backendFetch as unknown as typeof window.fetch;
  setShownWorkspace(null);
  stop = startWorkspaceSessionGuard();
});

afterEach(() => {
  stop();
  vi.mocked(WorkspacesService.workspaceAdminControllerGetCurrent).mockReset();
});

function sentHeaders(call = 0): Headers {
  const init = backendFetch.mock.calls[call][1] as RequestInit | undefined;
  return new Headers(init?.headers);
}

describe('workspace session guard', () => {
  it('sends the shown workspace on API requests only', async () => {
    setShownWorkspace('ws-a');
    await window.fetch('/api/v1/tasks/tasks', { method: 'POST', body: '{}' });
    expect(sentHeaders(0).get(EXPECTED_WORKSPACE_HEADER)).toBe('ws-a');

    await window.fetch('https://example.com/api/v1/x');
    expect(sentHeaders(1).get(EXPECTED_WORKSPACE_HEADER)).toBeNull();

    await window.fetch('/assets/logo.svg');
    expect(sentHeaders(2).get(EXPECTED_WORKSPACE_HEADER)).toBeNull();
  });

  it('sends no header before the workspace is known', async () => {
    await window.fetch('/api/v1/auth/me');
    expect(sentHeaders().get(EXPECTED_WORKSPACE_HEADER)).toBeNull();
  });

  it('reloads when the backend says the session moved to another workspace', async () => {
    setShownWorkspace('ws-a');
    backendFetch.mockResolvedValueOnce(changedResponse());
    const response = await window.fetch('/api/v1/tasks/tasks', { method: 'POST', body: '{}' });
    expect(response.status).toBe(409);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload on other conflicts', async () => {
    setShownWorkspace('ws-a');
    backendFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'WORKSPACE_SLUG_CONFLICT' }), { status: 409 }),
    );
    await window.fetch('/api/v1/workspaces', { method: 'POST' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads when another tab switches to a different workspace', async () => {
    setShownWorkspace('ws-a');
    announceWorkspaceSwitch('ws-b');
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('re-checks the session when the tab comes back to the foreground', () => {
    setShownWorkspace('ws-a');
    vi.mocked(WorkspacesService.workspaceAdminControllerGetCurrent).mockResolvedValue(
      {} as never,
    );
    window.dispatchEvent(new Event('focus'));
    expect(WorkspacesService.workspaceAdminControllerGetCurrent).toHaveBeenCalled();
  });
});
