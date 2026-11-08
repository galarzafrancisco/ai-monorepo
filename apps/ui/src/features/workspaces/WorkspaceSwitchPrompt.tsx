import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { LocatableRowKind, WorkspacesService, type WorkspaceResponseDto } from './api';
import { switchWorkspaceAndReload } from './reloadInWorkspace';
import './WorkspaceSwitchPrompt.css';

const KIND_LABEL: Record<LocatableRowKind, string> = {
  [LocatableRowKind.TASK]: 'task',
  [LocatableRowKind.THREAD]: 'thread',
  [LocatableRowKind.CONTEXT_BLOCK]: 'context block',
};

type WorkspaceSwitchPromptProps = {
  kind: LocatableRowKind;
  id: string | undefined;
  /** The usual "not found" view, shown while checking and when the row is in none of the person's other workspaces. */
  children: ReactNode;
};

/**
 * Wraps a "not found" view. When the row is in another workspace the person
 * belongs to, offers to switch to it (and reopen this page) instead.
 */
export function WorkspaceSwitchPrompt({ kind, id, children }: WorkspaceSwitchPromptProps) {
  const location = useLocation();
  const [elsewhere, setElsewhere] = useState<WorkspaceResponseDto | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setElsewhere(null);
    if (!id) return;
    let cancelled = false;
    WorkspacesService.workspaceAdminControllerLocate(kind, id)
      .then((workspace) => {
        if (!cancelled && !workspace.current) setElsewhere(workspace);
      })
      // 404: it does not exist, or is in no workspace the person is in.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  if (!elsewhere) return <>{children}</>;

  const onSwitch = async () => {
    setIsSwitching(true);
    setError('');
    try {
      await switchWorkspaceAndReload(
        elsewhere.id,
        `${location.pathname}${location.search}${location.hash}`,
      );
    } catch {
      setError('Could not switch workspace.');
      setIsSwitching(false);
    }
  };

  return (
    <div className="workspace-switch-prompt">
      <Card padding="5" className="workspace-switch-prompt__card">
        <Stack spacing="3" align="center">
          <Text size="4" weight="semibold">This {KIND_LABEL[kind]} is in another workspace</Text>
          <Text tone="muted">
            It is in <strong>{elsewhere.name}</strong>. Switch to that workspace to open it.
          </Text>
          <Button variant="primary" onClick={() => void onSwitch()} disabled={isSwitching}>
            {isSwitching ? 'Switching...' : `Switch to ${elsewhere.name}`}
          </Button>
          {error ? <ErrorText size="2">{error}</ErrorText> : null}
        </Stack>
      </Card>
    </div>
  );
}
