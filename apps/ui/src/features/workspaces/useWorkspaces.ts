import { useCallback, useEffect, useState } from 'react';
import { WorkspaceRole, WorkspacesService, type WorkspaceResponseDto } from './api';
import { switchWorkspaceAndReload } from './reloadInWorkspace';
import { getShownWorkspace, reloadPage, setShownWorkspace } from './workspaceSession';

export type WorkspacesState = {
  /** The workspaces the person is a member of, oldest membership first. */
  workspaces: WorkspaceResponseDto[];
  /** The workspace the session is in; null until loaded. */
  current: WorkspaceResponseDto | null;
  /** Whether the person is an admin of the current workspace (not the installation operator). */
  isWorkspaceAdmin: boolean;
  isLoading: boolean;
  /** Set when the first load failed: the app can't know which workspace it is in. */
  loadError: string | null;
  reload: () => Promise<void>;
  switchTo: (workspaceId: string) => Promise<void>;
};

export function useWorkspaces(): WorkspacesState {
  const [workspaces, setWorkspaces] = useState<WorkspaceResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await WorkspacesService.workspaceAdminControllerListMine();
      const currentId = list.find((workspace) => workspace.current)?.id ?? null;
      const shown = getShownWorkspace();
      if (shown && currentId !== shown) {
        // The session moved to another workspace (another tab switched). This
        // page holds the old workspace's data: start over rather than adopt it.
        reloadPage();
        return;
      }
      // Pinned here, before the state update that lets workspace-bound
      // children mount, so their very first request already carries it.
      setShownWorkspace(currentId);
      setWorkspaces(list);
      setLoadError(currentId ? null : 'Your session is not in any workspace.');
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      // Only the first load decides whether the app may start; once a
      // workspace is pinned, a failed refresh keeps the list as it was.
      if (!getShownWorkspace()) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load workspaces');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const switchTo = useCallback(async (workspaceId: string) => {
    await switchWorkspaceAndReload(workspaceId);
  }, []);

  const current = workspaces.find((workspace) => workspace.current) ?? null;

  return {
    workspaces,
    current,
    isWorkspaceAdmin: current?.role === WorkspaceRole.ADMIN,
    isLoading,
    loadError,
    reload,
    switchTo,
  };
}
