import { useCallback, useEffect, useState } from 'react';
import { WorkspaceRole, WorkspacesService, type WorkspaceResponseDto } from './api';
import { switchWorkspaceAndReload } from './reloadInWorkspace';

export type WorkspacesState = {
  /** The workspaces the person is a member of, oldest membership first. */
  workspaces: WorkspaceResponseDto[];
  /** The workspace the session is in; null until loaded. */
  current: WorkspaceResponseDto | null;
  /** Whether the person is an admin of the current workspace (not the installation operator). */
  isWorkspaceAdmin: boolean;
  isLoading: boolean;
  reload: () => Promise<void>;
  switchTo: (workspaceId: string) => Promise<void>;
};

export function useWorkspaces(): WorkspacesState {
  const [workspaces, setWorkspaces] = useState<WorkspaceResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setWorkspaces(await WorkspacesService.workspaceAdminControllerListMine());
    } catch (error) {
      console.error('Failed to load workspaces:', error);
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
    reload,
    switchTo,
  };
}
