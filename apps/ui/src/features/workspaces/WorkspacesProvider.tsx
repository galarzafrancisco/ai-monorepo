import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth';
import { DraftScopeContext, removeUnscopedDrafts } from '../../shared/context/DraftScopeContext';
import { useWorkspaces, type WorkspacesState } from './useWorkspaces';
import { setShownWorkspace, startWorkspaceSessionGuard } from './workspaceSession';

const WorkspacesContext = createContext<WorkspacesState | undefined>(undefined);

/**
 * The person's workspaces and the one the session is in. Needs a signed-in
 * session. Also keeps this tab on that workspace (see `workspaceSession`) and
 * scopes drafts to the person and workspace.
 */
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaces();
  const { user } = useAuth();
  const currentId = value.current?.id ?? null;

  useEffect(() => {
    removeUnscopedDrafts();
    return startWorkspaceSessionGuard();
  }, []);

  useEffect(() => {
    setShownWorkspace(currentId);
  }, [currentId]);

  const draftScope = user && currentId ? `${user.actorId}:${currentId}` : null;

  return (
    <WorkspacesContext.Provider value={value}>
      <DraftScopeContext.Provider value={draftScope}>{children}</DraftScopeContext.Provider>
    </WorkspacesContext.Provider>
  );
}

export function useWorkspacesCtx(): WorkspacesState {
  const context = useContext(WorkspacesContext);
  if (!context) {
    throw new Error('useWorkspacesCtx must be used within WorkspacesProvider');
  }
  return context;
}
