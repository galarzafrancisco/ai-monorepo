import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth';
import { DraftScopeContext, removeUnscopedDrafts } from '../../shared/context/DraftScopeContext';
import { Button, ErrorText, Stack } from '../../ui/primitives';
import { useWorkspaces, type WorkspacesState } from './useWorkspaces';
import { setShownWorkspace, startWorkspaceSessionGuard } from './workspaceSession';
import './WorkspacesProvider.css';

const WorkspacesContext = createContext<WorkspacesState | undefined>(undefined);

/**
 * The person's workspaces and the one the session is in. Needs a signed-in
 * session. Also keeps this tab on that workspace (see `workspaceSession`) and
 * scopes drafts to the person and workspace.
 *
 * It is a gate: children (every workspace-bound provider, page, composer and
 * socket) mount only once the session's workspace is known and pinned, so
 * their first request already carries it and their drafts load in the right
 * scope. If the workspace can't be resolved the app does not start; it shows
 * an error with a retry instead.
 */
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaces();
  const { user } = useAuth();
  const currentId = value.current?.id ?? null;

  useEffect(() => {
    removeUnscopedDrafts();
    const stop = startWorkspaceSessionGuard();
    return () => {
      stop();
      setShownWorkspace(null);
    };
  }, []);

  if (!user || !currentId) {
    if (value.isLoading || !value.loadError) return null;
    return (
      <div className="workspaces-gate">
        <Stack spacing="3" align="center">
          <ErrorText>Couldn't load your workspace: {value.loadError}</ErrorText>
          <Button onClick={() => void value.reload()}>Try again</Button>
        </Stack>
      </div>
    );
  }

  return (
    <WorkspacesContext.Provider value={value}>
      <DraftScopeContext.Provider value={`${user.actorId}:${currentId}`}>{children}</DraftScopeContext.Provider>
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
