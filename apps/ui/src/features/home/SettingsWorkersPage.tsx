import { Stack, Text, Card, Row, Button } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { useWorkers } from '../workers/useWorkers';
import { ErrorText } from '../../ui/primitives/ErrorText';
import {
  Heart,
  HeartCrack,
} from "lucide-react";

import './SettingsWorkersPage.css';

export function SettingsWorkersPage() {
  const { setSectionTitle } = useHomeCtx();
  const { workers, isLoading, error } = useWorkers();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSectionTitle('Workers Settings');
  }, []);

  const serverUrl = `${window.location.protocol}//${window.location.host}`;
  const workerCommand = `npx -y @taico/worker --serverurl ${serverUrl}`;

  const isWorkerConnected = (lastSeenAt: string) => {
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const fiveMinutesMs = 2 * 60 * 1000;
    return diffMs <= fiveMinutesMs;
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(workerCommand);
      setCopyFeedback('Copied');
      window.setTimeout(() => setCopyFeedback(null), 1800);
    } catch {
      setCopyFeedback('Copy failed');
      window.setTimeout(() => setCopyFeedback(null), 1800);
    }
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

      {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}

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
            <Button
              className="settings-workers__copy-button"
              variant="secondary"
              size="sm"
              onClick={copyCommand}
            >
              {copyFeedback ?? 'Copy'}
            </Button>
          </div>

          <Text size="1" tone="muted">
            The worker will automatically register and appear in the list below when it connects.
          </Text>
        </Stack>
      </Card>

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
                        {isConnected ? (
                          <Heart
                            className="settings-workers__status-icon settings-workers__status-icon--connected"
                            size={18}
                            strokeWidth={1.5}
                            absoluteStrokeWidth
                            aria-label="Connected"
                          />
                        ) : (
                          <HeartCrack
                            className="settings-workers__status-icon settings-workers__status-icon--disconnected"
                            size={18}
                            strokeWidth={1.5}
                            absoluteStrokeWidth
                            aria-label="Disconnected"
                          />
                        )}
                      </div>
                      <Text size="1" tone="muted">
                        ID: {worker.id}
                      </Text>
                      <Text size="1" tone="muted">
                        Version: {worker.workerVersion ?? 'Unknown'}
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
