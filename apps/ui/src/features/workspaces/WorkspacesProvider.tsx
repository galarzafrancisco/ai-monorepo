import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useWorkspaces, type WorkspacesState } from './useWorkspaces';

const WorkspacesContext = createContext<WorkspacesState | undefined>(undefined);

/** The person's workspaces and the one the session is in. Needs a signed-in session. */
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaces();
  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>;
}

export function useWorkspacesCtx(): WorkspacesState {
  const context = useContext(WorkspacesContext);
  if (!context) {
    throw new Error('useWorkspacesCtx must be used within WorkspacesProvider');
  }
  return context;
}
