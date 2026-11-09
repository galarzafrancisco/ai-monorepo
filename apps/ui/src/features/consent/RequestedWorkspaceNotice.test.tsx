// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const workspaces = [
  { id: 'ws-default', slug: 'default', name: 'Default', role: 'member', current: true },
  { id: 'ws-acme', slug: 'acme', name: 'Acme', role: 'member', current: false },
];
const listMine = vi.fn();

vi.mock('../workspaces/WorkspacesProvider', () => ({
  useWorkspacesCtx: () => ({ workspaces }),
}));
vi.mock('../workspaces/api', () => ({
  WorkspacesService: { workspaceAdminControllerListMine: listMine },
}));
vi.mock('../workspaces/reloadInWorkspace', () => ({
  switchWorkspaceAndReload: vi.fn(async () => undefined),
}));

import { switchWorkspaceAndReload } from '../workspaces/reloadInWorkspace';
import { RequestedWorkspaceNotice } from './RequestedWorkspaceNotice';

const consentUrl = '/consent?flow=abc';

const setIsSwitching = vi.fn();

function renderNotice(slug: string, submitting = false) {
  return render(
    <MemoryRouter initialEntries={[consentUrl]}>
      <RequestedWorkspaceNotice
        requestedSlug={slug}
        isSwitching={false}
        setIsSwitching={setIsSwitching}
        isSubmitting={submitting}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('RequestedWorkspaceNotice', () => {
  it('offers the switch right away for a known membership, without fetching the list again', () => {
    renderNotice('acme');
    const button = screen.getByRole('button', { name: 'Switch to Acme' });
    expect(screen.queryByText(/not a member/)).toBeNull();
    fireEvent.click(button);
    expect(setIsSwitching).toHaveBeenCalledWith(true);
    expect(switchWorkspaceAndReload).toHaveBeenCalledWith('ws-acme', consentUrl);
    expect(listMine).not.toHaveBeenCalled();
  });

  it('holds the switch once a decision has been sent', () => {
    vi.mocked(switchWorkspaceAndReload).mockClear();
    renderNotice('acme', true);
    const button = screen.getByRole('button', { name: 'Switch to Acme' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(switchWorkspaceAndReload).not.toHaveBeenCalled();
  });

  it('says the person is not a member of an unknown workspace', () => {
    renderNotice('other');
    expect(screen.getByText(/not a member/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
