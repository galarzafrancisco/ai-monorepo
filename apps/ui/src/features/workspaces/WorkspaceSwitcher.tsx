import { useState } from 'react';
import { useToast } from '../../shared/context/ToastContext';
import { useWorkspacesCtx } from './WorkspacesProvider';
import './WorkspaceSwitcher.css';

/**
 * The current workspace, and a picker for the others when the person is in
 * more than one. Choosing one switches the session and reloads the app.
 */
export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { workspaces, current, switchTo } = useWorkspacesCtx();
  const { showToast } = useToast();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!current) return null;

  if (compact) {
    return (
      <div className="workspace-switcher workspace-switcher--compact" title={current.name} aria-label={`Workspace: ${current.name}`}>
        {current.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  if (workspaces.length < 2) {
    return (
      <div className="workspace-switcher">
        <span className="workspace-switcher__label">Workspace</span>
        <span className="workspace-switcher__name" title={current.name}>{current.name}</span>
      </div>
    );
  }

  const onChange = async (workspaceId: string) => {
    if (workspaceId === current.id) return;
    setIsSwitching(true);
    try {
      await switchTo(workspaceId);
    } catch (error) {
      console.error('Failed to switch workspace:', error);
      showToast('Could not switch workspace.', 'error');
      setIsSwitching(false);
    }
  };

  return (
    <label className="workspace-switcher">
      <span className="workspace-switcher__label">Workspace</span>
      <select
        className="workspace-switcher__select"
        value={current.id}
        disabled={isSwitching}
        onChange={(event) => void onChange(event.target.value)}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
