// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const consentCtx = {
  setSectionTitle: vi.fn(),
  loadConsentMetadata: vi.fn(),
  submitConsent: vi.fn(),
  consentMetadata: null as unknown,
  isLoading: false,
  isApproving: false,
  error: null as string | null,
};
const switchWorkspaceAndReload = vi.fn<[string, string?], Promise<void>>();

vi.mock('./ConsentProvider', () => ({ useConsentCtx: () => consentCtx }));
vi.mock('../workspaces', () => ({
  useWorkspacesCtx: () => ({
    workspaces: [
      { id: 'a', slug: 'a', name: 'Workspace A' },
      { id: 'b', slug: 'b', name: 'Workspace B' },
    ],
  }),
}));
vi.mock('../workspaces/reloadInWorkspace', () => ({
  switchWorkspaceAndReload: (...args: [string, string?]) => switchWorkspaceAndReload(...args),
}));
vi.mock('../../app/hooks/useIsDesktop', () => ({ useIsDesktop: () => true }));

import { ConsentPage } from './ConsentPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/consent?flow=test-flow']}>
      <ConsentPage />
    </MemoryRouter>,
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  consentCtx.submitConsent.mockReset();
  consentCtx.isApproving = false;
  consentCtx.consentMetadata = {
    client: { clientName: 'Client', clientId: 'client-1', registrationMethod: 'dynamic' },
    scopes: ['tasks:read'],
    redirectUri: 'https://client.example/callback',
    server: { name: 'Tasks', providedId: 'tasks' },
    resource: 'https://taico.example/tasks',
    createdAt: new Date().toISOString(),
    workspace: { id: 'a', slug: 'a', name: 'Workspace A' },
  };
  switchWorkspaceAndReload.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ConsentPage workspace switching', () => {
  it('sends no decision while a workspace switch is on its way', async () => {
    const pending = deferred();
    switchWorkspaceAndReload.mockReturnValue(pending.promise);
    renderPage();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    await screen.findByText('Switching workspace…');

    const approve = screen.getByRole('button', { name: 'Approve' });
    const deny = screen.getByRole('button', { name: 'Deny' });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    expect((deny as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(approve);
    fireEvent.click(deny);
    expect(consentCtx.submitConsent).not.toHaveBeenCalled();
    expect(switchWorkspaceAndReload).toHaveBeenCalledWith('b', expect.any(String));
  });

  it('allows a decision again after a failed switch', async () => {
    const pending = deferred();
    switchWorkspaceAndReload.mockReturnValue(pending.promise);
    renderPage();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    pending.reject(new Error('nope'));
    await screen.findByText('Could not switch workspace. Try again.');

    const approve = screen.getByRole('button', { name: 'Approve' });
    expect((approve as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(approve);
    expect(consentCtx.submitConsent).toHaveBeenCalledWith('test-flow', 'tasks', true, 'a');
  });

  it('holds the picker once a decision has been sent', () => {
    consentCtx.isApproving = true;
    renderPage();

    const picker = screen.getByRole('combobox');
    expect((picker as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(picker, { target: { value: 'b' } });
    expect(switchWorkspaceAndReload).not.toHaveBeenCalled();
  });
});
