import { useState } from 'react';
import { Card, ErrorText } from '../../ui/primitives';
import { useWorkspacesCtx } from '../workspaces';
import { switchWorkspaceAndReload } from '../workspaces/reloadInWorkspace';

type ConsentWorkspace = { id: string; slug: string; name: string };

/**
 * Which workspace the client gets access to, shown first on the consent screen.
 *
 * For Taico's own servers (tasks, context, workers) the token is for the
 * workspace the web session is in, so a person in several workspaces can pick
 * one here: picking switches the session and reloads this same consent page,
 * which then shows (and approves in) the new workspace. Any other server only
 * works in its own workspace, so there is nothing to pick.
 */
export function ConsentWorkspaceCard({
  workspace,
  followsSession,
}: {
  workspace: ConsentWorkspace;
  followsSession: boolean;
}) {
  const { workspaces } = useWorkspacesCtx();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const canPick = followsSession && workspaces.length > 1;

  const onPick = async (workspaceId: string) => {
    if (workspaceId === workspace.id) return;
    setIsSwitching(true);
    setSwitchError(null);
    try {
      // Same page, same flow: only the session's workspace changes.
      await switchWorkspaceAndReload(workspaceId, window.location.pathname + window.location.search);
    } catch (error) {
      console.error('Failed to switch workspace:', error);
      setSwitchError('Could not switch workspace. Try again.');
      setIsSwitching(false);
    }
  };

  return (
    <Card className="detail-section consent-workspace">
      <h2>WHICH workspace</h2>
      {canPick ? (
        <label className="consent-workspace__picker">
          <span className="consent-workspace__label">Grant access in</span>
          <select
            className="consent-workspace__select"
            value={workspace.id}
            disabled={isSwitching}
            onChange={(event) => void onPick(event.target.value)}
          >
            {workspaces.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} (@{option.slug})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <div className="server-name">{workspace.name}</div>
          <div className="server-id">@{workspace.slug}</div>
        </>
      )}
      <p className="consent-workspace__note">
        {followsSession
          ? canPick
            ? `The client will only see and act on ${workspace.name}'s tasks, context and agents. Changing the workspace here also switches the workspace you are in across Taico.`
            : `The client will only see and act on ${workspace.name}'s tasks, context and agents.`
          : `This server belongs to ${workspace.name}, so access is always granted there.`}
      </p>
      {isSwitching ? <p className="consent-workspace__note">Switching workspace…</p> : null}
      {switchError ? <ErrorText>{switchError}</ErrorText> : null}
    </Card>
  );
}
