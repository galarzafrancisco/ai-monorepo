import { useEffect, useState } from 'react';
import { Stack, Text, Button } from '../../ui/primitives';
import { useTaskerooCtx } from './TaskerooProvider';
import { BoardView } from './BoardView';
import { ListView } from './ListView';
import { ErrorText } from '../../ui/primitives/ErrorText';
import './TaskerooDesktopView.css';

type ViewMode = 'board' | 'list';

const viewModeStorageKey = 'taskeroo.viewMode';

const getInitialViewMode = (): ViewMode => {
  if (typeof window === 'undefined') {
    return 'board';
  }

  const stored = window.localStorage.getItem(viewModeStorageKey);
  return stored === 'list' || stored === 'board' ? stored : 'board';
};

function LoadingState() {
  return (
    <div className="taskeroo-desktop__state">
      <Text tone="muted">Loading tasks...</Text>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="taskeroo-desktop__state">
      <Stack spacing="3" align="center">
        <Text size="4" tone="muted">Error loading tasks</Text>
        <Text tone="muted">{error}</Text>
      </Stack>
    </div>
  );
}

function ConnectionHeader() {
  const { isConnected } = useTaskerooCtx();
  return isConnected || <ErrorText>Disconnected</ErrorText>;
}

export function TaskerooDesktopView() {
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const { tasks, isLoading, error } = useTaskerooCtx();

  useEffect(() => {
    window.localStorage.setItem(viewModeStorageKey, viewMode);
  }, [viewMode]);

  return (
    <Stack spacing="5">
      {/* Header */}
      <Stack spacing="2">
        <div className="taskeroo-desktop__header">
          <div>
            <Text size="6" weight="bold">Taskeroo</Text>
            <ConnectionHeader />
            <Text tone="muted">Manage your tasks and track progress</Text>
          </div>

          {/* View toggle buttons */}
          <div className="taskeroo-desktop__view-toggle">
            <Button
              variant={viewMode === 'board' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('board')}
            >
              📋 Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('list')}
            >
              📝 List
            </Button>
          </div>
        </div>
      </Stack>

      {/* Content */}
      {isLoading && tasks.length === 0 ? (
        <LoadingState />
      ) : error && tasks.length === 0 ? (
        <ErrorState error={error} />
      ) : (
        <div className="taskeroo-desktop__content">
          {viewMode === 'board' ? (
            <BoardView tasks={tasks} />
          ) : (
            <ListView tasks={tasks} />
          )}
        </div>
      )}
    </Stack>
  );
}
