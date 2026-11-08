// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  WorkspaceRole: { ADMIN: 'admin', MEMBER: 'member' },
  WorkspacesService: {
    workspaceAdminControllerListMine: vi.fn(),
    workspaceAdminControllerGetCurrent: vi.fn(),
  },
}));
vi.mock('../../auth', () => ({
  useAuth: () => ({ user: { actorId: 'person-1' } }),
}));

import { WorkspacesService } from './api';
import { WorkspacesProvider, useWorkspacesCtx } from './WorkspacesProvider';
import { EXPECTED_WORKSPACE_HEADER, getShownWorkspace } from './workspaceSession';

const reload = vi.fn();
let backendFetch: ReturnType<typeof vi.fn<Parameters<typeof fetch>, Promise<Response>>>;

function workspace(id: string, current: boolean) {
  return { id, name: id, role: 'member', current };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A workspace-bound feature: loads data on mount, like every feature provider. */
function Feature() {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    void fetch('/api/v1/tasks').then(() => setData('loaded'));
  }, []);
  return <div>feature {data ?? 'loading'}</div>;
}

function ReloadButton() {
  const { reload: reloadList } = useWorkspacesCtx();
  return <button onClick={() => void reloadList()}>reload list</button>;
}

beforeEach(() => {
  reload.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, href: 'http://localhost/tasks', origin: 'http://localhost', reload },
  });
  backendFetch = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () => new Response('{}', { status: 200 }));
  window.fetch = backendFetch as unknown as typeof window.fetch;
});

afterEach(() => {
  cleanup();
  vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockReset();
});

describe('WorkspacesProvider', () => {
  it('mounts nothing workspace-bound until the workspace is pinned', async () => {
    const list = deferred<ReturnType<typeof workspace>[]>();
    vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockReturnValue(list.promise as never);

    render(
      <WorkspacesProvider>
        <Feature />
      </WorkspacesProvider>,
    );

    // Still resolving: the feature has not mounted and made no request.
    expect(screen.queryByText(/feature/)).toBeNull();
    expect(backendFetch).not.toHaveBeenCalled();

    await act(async () => list.resolve([workspace('ws-a', false), workspace('ws-b', true)]));

    // It mounts in the session's workspace, and its first request carries it.
    expect(await screen.findByText('feature loaded')).toBeTruthy();
    expect(getShownWorkspace()).toBe('ws-b');
    const init = backendFetch.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get(EXPECTED_WORKSPACE_HEADER)).toBe('ws-b');
  });

  it('does not start the app when the workspace cannot be resolved, and retries', async () => {
    vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockRejectedValueOnce(new Error('offline'));

    render(
      <WorkspacesProvider>
        <Feature />
      </WorkspacesProvider>,
    );

    expect(await screen.findByText(/Couldn't load your workspace/)).toBeTruthy();
    expect(screen.queryByText(/feature/)).toBeNull();
    expect(backendFetch).not.toHaveBeenCalled();

    vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockResolvedValueOnce([
      workspace('ws-a', true),
    ] as never);
    await act(async () => screen.getByText('Try again').click());

    expect(await screen.findByText('feature loaded')).toBeTruthy();
    expect(getShownWorkspace()).toBe('ws-a');
  });

  it('fails closed when the session is in no workspace', async () => {
    vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockResolvedValueOnce([
      workspace('ws-a', false),
    ] as never);

    render(
      <WorkspacesProvider>
        <Feature />
      </WorkspacesProvider>,
    );

    expect(await screen.findByText(/not in any workspace/)).toBeTruthy();
    expect(screen.queryByText(/feature/)).toBeNull();
  });

  it('reloads instead of adopting another workspace once one is pinned', async () => {
    vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockResolvedValueOnce([
      workspace('ws-a', true),
      workspace('ws-b', false),
    ] as never);

    render(
      <WorkspacesProvider>
        <Feature />
        <ReloadButton />
      </WorkspacesProvider>,
    );
    expect(await screen.findByText('feature loaded')).toBeTruthy();

    // Another tab moved the session to B; this page still holds A's data.
    vi.mocked(WorkspacesService.workspaceAdminControllerListMine).mockResolvedValueOnce([
      workspace('ws-a', false),
      workspace('ws-b', true),
    ] as never);
    await act(async () => screen.getByText('reload list').click());

    expect(reload).toHaveBeenCalledTimes(1);
    expect(getShownWorkspace()).toBe('ws-a');
  });
});
