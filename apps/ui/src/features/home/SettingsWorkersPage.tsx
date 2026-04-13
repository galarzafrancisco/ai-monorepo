import { Stack, Text, Card, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect } from 'react';
import { useWorkers } from '../workers/useWorkers';
import './SettingsWorkersPage.css';

export function SettingsWorkersPage() {
  const { setSectionTitle } = useHomeCtx();
  const { workers, isLoading, error } = useWorkers();

  useEffect(() => {
    setSectionTitle('Workers Settings');
  }, []);

  // Get the server URL from the current window location
  const serverUrl = `${window.location.protocol}//${window.location.host}`;
  const workerCommand = `npx -y @taico/worker --serverurl ${serverUrl}`;

  // Check if a worker is connected (last seen within 5 minutes)
  const isWorkerConnected = (lastSeenAt: string) => {
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const fiveMinutesMs = 5 * 60 * 1000;
    return diffMs <= fiveMinutesMs;
  };

  if (isLoading) {
    return (
      <Stack spacing="6">
        <Text>Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack spacing="6">
      <Text tone="muted">
        Workers execute tasks in the background. Configure workers to enable automated task execution.
      </Text>

      {error && (
        <Card padding="5" className="settings-workers__error-card">
          <Text>Error: {error}</Text>
        </Card>
      )}

      {/* Configuration Instructions */}
      <Card padding="5">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">
              Configure a New Worker
            </Text>
            <Text tone="muted">
              Run this command in your terminal to start a new worker:
            </Text>
          </Stack>

          <div className="settings-workers__command-container">
            <code className="settings-workers__command">{workerCommand}</code>
            <button
              className="settings-workers__copy-button"
              onClick={() => {
                navigator.clipboard.writeText(workerCommand);
              }}
              title="Copy to clipboard"
            >
              Copy
            </button>
          </div>

          <Text size="1" tone="muted">
            The worker will automatically register and appear in the list below when it connects.
          </Text>
        </Stack>
      </Card>

      {/* Workers List */}
      <Stack spacing="3">
        <Text size="4" weight="semibold">
          Registered Workers ({workers.length})
        </Text>

        {workers.length === 0 ? (
          <Card padding="5">
            <Text tone="muted">
              No workers registered yet. Run the command above to start your first worker.
            </Text>
          </Card>
        ) : (
          workers.map((worker) => {
            const isConnected = isWorkerConnected(worker.lastSeenAt);
            const lastSeenDate = new Date(worker.lastSeenAt);
            const lastSeenStr = lastSeenDate.toLocaleString();

            return (
              <Card key={worker.id} padding="5">
                <Stack spacing="3">
                  <Row justify="space-between" align="center">
                    <Stack spacing="1">
                      <div className="settings-workers__title-row">
                        <Text size="3" weight="semibold">
                          Worker
                        </Text>
                        <span
                          className={`settings-workers__status-indicator ${
                            isConnected
                              ? 'settings-workers__status-indicator--connected'
                              : 'settings-workers__status-indicator--disconnected'
                          }`}
                        >
                          {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <Text size="1" tone="muted">
                        ID: {worker.id}
                      </Text>
                      <Text size="1" tone="muted">
                        Last seen: {lastSeenStr}
                      </Text>
                    </Stack>
                  </Row>

                  {worker.harnesses && worker.harnesses.length > 0 && (
                    <Stack spacing="1">
                      <Text size="2" weight="medium">
                        Harnesses:
                      </Text>
                      <div className="settings-workers__harnesses">
                        {worker.harnesses.map((harness) => (
                          <span key={harness} className="settings-workers__harness-badge">
                            {harness}
                          </span>
                        ))}
                      </div>
                    </Stack>
                  )}
                </Stack>
              </Card>
            );
          })
        )}
      </Stack>
    </Stack>
  );
}
