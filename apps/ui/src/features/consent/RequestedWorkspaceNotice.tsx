import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useWorkspacesCtx } from '../workspaces/WorkspacesProvider';
import { switchWorkspaceAndReload } from '../workspaces/reloadInWorkspace';

type RequestedWorkspaceNoticeProps = {
  /** Slug of the workspace the client asked for (a worker started with --workspace). */
  requestedSlug: string;
  /** Page-owned: a switch is on its way (Approve/Deny are held meanwhile). */
  isSwitching: boolean;
  setIsSwitching: (isSwitching: boolean) => void;
  /** Page-owned: a decision has been sent, so no switch may start. */
  isSubmitting: boolean;
};

/**
 * Shown when the client asked for another workspace than the one the person
 * is in: approval is refused there, so offer to switch (and reopen this page).
 * Switching state is the page's, shared with the workspace picker, so a
 * decision can't be sent while either is switching.
 */
export function RequestedWorkspaceNotice({
  requestedSlug,
  isSwitching,
  setIsSwitching,
  isSubmitting,
}: RequestedWorkspaceNoticeProps) {
  const location = useLocation();
  const { workspaces } = useWorkspacesCtx();
  const requested = workspaces.find((workspace) => workspace.slug === requestedSlug);
  const [error, setError] = useState('');

  const onSwitch = async () => {
    if (!requested || isSwitching || isSubmitting) return;
    setIsSwitching(true);
    setError('');
    try {
      // On success the page reloads, so isSwitching stays true until then.
      await switchWorkspaceAndReload(requested.id, `${location.pathname}${location.search}`);
    } catch {
      setError('Could not switch workspace.');
      setIsSwitching(false);
    }
  };

  return (
    <div className="consent-warning">
      <p style={{ margin: 0 }}>
        This client asks to connect to the workspace <strong>@{requestedSlug}</strong>, so it can only be approved from there.
        {requested ? null : ' You are not a member of a workspace with that slug.'}
      </p>
      {requested ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button variant="primary" onClick={() => void onSwitch()} disabled={isSwitching || isSubmitting}>
            {isSwitching ? 'Switching...' : `Switch to ${requested.name}`}
          </Button>
        </div>
      ) : null}
      {error ? <ErrorText size="2">{error}</ErrorText> : null}
    </div>
  );
}
