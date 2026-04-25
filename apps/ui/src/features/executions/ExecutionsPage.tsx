import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Button, Card, Text } from "../../ui/primitives";
import { useActorsCtx } from "../actors";
import { useWorkers } from "../workers/useWorkers";
import { ExecutionsService } from "./api";
import type {
  ActiveTaskExecutionResponseDto,
  TaskExecutionHistoryResponseDto,
  TaskExecutionQueueEntryResponseDto,
} from "./types";
import { useToast } from "../../shared/context/ToastContext";
import { useExecutions } from "./useExecutions";
import "./ExecutionsPage.css";

type ExecutionDetailResult =
  | { kind: "queue"; entry: TaskExecutionQueueEntryResponseDto }
  | { kind: "active"; entry: ActiveTaskExecutionResponseDto }
  | { kind: "history"; entry: TaskExecutionHistoryResponseDto };

type RunFeedEntry =
  | { kind: "queue"; entry: TaskExecutionQueueEntryResponseDto }
  | { kind: "active"; entry: ActiveTaskExecutionResponseDto }
  | { kind: "history"; entry: TaskExecutionHistoryResponseDto };

type ActorSummary = { id: string; displayName?: string; slug?: string };

export function ExecutionsPage() {
  const navigate = useNavigate();
  const { actors } = useActorsCtx();
  const { showToast, showError } = useToast();
  const { queue, active, history, isLoading, hasLoadedOnce, error, loadExecutions } = useExecutions();
  const { workers } = useWorkers();
  const [interruptingExecutions, setInterruptingExecutions] = useState<Set<string>>(() => new Set());

  useDocumentTitle();

  const connectedWorkersCount = useMemo(() => {
    const now = Date.now();
    const twoMinutesMs = 2 * 60 * 1000;
    return workers.filter((worker) => now - new Date(worker.lastSeenAt).getTime() <= twoMinutesMs).length;
  }, [workers]);

  const feedEntries = useMemo<RunFeedEntry[]>(() => [
    ...queue.map((entry) => ({ kind: "queue" as const, entry })),
    ...active.map((entry) => ({ kind: "active" as const, entry })),
    ...history.map((entry) => ({ kind: "history" as const, entry })),
  ], [active, history, queue]);

  const handleInterruptExecution = async (executionId: string, taskName: string | null) => {
    if (!confirm(`Are you sure you want to interrupt the execution for "${taskName ?? "Untitled task"}"?`)) {
      return;
    }

    setInterruptingExecutions((prev) => new Set(prev).add(executionId));

    try {
      await ExecutionsService.ActiveTaskExecutionController_interruptExecution({ executionId });
      showToast(`Interrupt signal sent for "${taskName ?? "Untitled task"}"`);
      await loadExecutions();
    } catch (err) {
      showError(err);
    } finally {
      setInterruptingExecutions((prev) => {
        const next = new Set(prev);
        next.delete(executionId);
        return next;
      });
    }
  };

  return (
    <div className="executions-page">
      <div className="executions-hero">
        <div className="executions-worker-status">
          <span
            className="executions-worker-status__indicator"
            style={{ color: connectedWorkersCount > 0 ? "var(--success)" : "var(--danger)" }}
            aria-label={connectedWorkersCount > 0 ? "Workers connected" : "No workers connected"}
          >
            ●
          </span>
          <Text as="span" size="2" tone="muted">
            {connectedWorkersCount > 0
              ? `${connectedWorkersCount} worker${connectedWorkersCount !== 1 ? "s" : ""} connected`
              : "no worker connected"}
            {" · "}
            <button
              type="button"
              className="executions-worker-status__link"
              onClick={() => navigate("/settings/workers")}
            >
              configure
            </button>
          </Text>
        </div>
        {error ? <span className="executions-error-copy">Fetch failed</span> : null}
      </div>

      {isLoading && !hasLoadedOnce ? (
        <Card className="executions-empty-card">
          <Text as="div" size="3" weight="medium">Loading executions...</Text>
        </Card>
      ) : null}

      {error ? (
        <Card className="executions-empty-card">
          <Text as="div" size="3" weight="medium">Could not load executions</Text>
          <Text as="div" tone="muted" wrap>{error}</Text>
        </Card>
      ) : null}

      {hasLoadedOnce && !error ? (
        feedEntries.length > 0 ? (
          <div className="executions-feed" aria-label="Execution runs">
            {feedEntries.map((feedEntry) => {
              const key = getRunKey(feedEntry);
              const runPath = getRunPath(feedEntry);
              const actor = getActorForRun(feedEntry, actors);
              const isInterrupting = feedEntry.kind === "active" && interruptingExecutions.has(feedEntry.entry.id);

              return (
                <RunFeedRow
                  key={key}
                  feedEntry={feedEntry}
                  actor={actor}
                  isInterrupting={isInterrupting}
                  onClick={() => navigate(runPath)}
                  onInterrupt={feedEntry.kind === "active"
                    ? () => void handleInterruptExecution(feedEntry.entry.id, feedEntry.entry.taskName)
                    : undefined}
                />
              );
            })}
          </div>
        ) : (
          <Card className="executions-empty-card">
            <Text as="div" size="3" weight="medium">No executions yet</Text>
            <Text as="div" tone="muted">Queued, running, and completed executions will appear here.</Text>
          </Card>
        )
      ) : null}
    </div>
  );
}

export function ExecutionDetailPage() {
  const navigate = useNavigate();
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const { actors } = useActorsCtx();
  const { queue, active, history, isLoading, hasLoadedOnce, error } = useExecutions();

  useDocumentTitle();

  const detail = useMemo<ExecutionDetailResult | null>(() => {
    if (!kind || !id) {
      return null;
    }

    if (kind === "queue") {
      const entry = queue.find((candidate) => candidate.taskId === id);
      return entry ? { kind: "queue", entry } : null;
    }

    if (kind === "active") {
      const entry = active.find((candidate) => candidate.id === id);
      return entry ? { kind: "active", entry } : null;
    }

    if (kind === "history") {
      const entry = history.find((candidate) => candidate.id === id);
      return entry ? { kind: "history", entry } : null;
    }

    return null;
  }, [active, history, id, kind, queue]);

  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="executions-page">
        <Card className="executions-empty-card">
          <Text as="div" size="3" weight="medium">Loading run...</Text>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="executions-page">
        <Card className="executions-empty-card">
          <Text as="div" size="3" weight="medium">Could not load run</Text>
          <Text as="div" tone="muted" wrap>{error}</Text>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="executions-page executions-page--detail">
        <div className="executions-detail-topbar">
          <Button variant="secondary" onClick={() => navigate("/runs")}>Back to runs</Button>
        </div>
        <Text as="div" size="5" weight="bold">Run not found</Text>
        <Text as="div" tone="muted" wrap>The run may have moved between queued, active, and historical states.</Text>
      </div>
    );
  }

  const actor = getActorForRun(detail, actors);
  const title = detail.entry.taskName ?? "Untitled task";
  const statusLabel = getRunStatusLabel(detail);

  return (
    <div className="executions-page executions-page--detail">
      <div className="executions-detail-topbar">
        <Button variant="secondary" onClick={() => navigate("/runs")}>Back to runs</Button>
        <Button variant="secondary" onClick={() => navigate(`/tasks/task/${detail.entry.taskId}`)}>Open task</Button>
      </div>

      <header className="executions-run-header">
        <RunStatusIcon feedEntry={detail} />
        <div className="executions-run-header__copy">
          <Text as="div" size="5" weight="bold" wrap>{title}</Text>
          <Text as="div" size="2" tone="muted">
            {actor ? `picked by @${actor.slug ?? actor.displayName ?? actor.id}` : "waiting to be picked"}
          </Text>
        </div>
        <Text as="div" size="2" tone="muted" className="executions-run-status-label">{statusLabel}</Text>
      </header>

      {detail.kind === "queue" ? (
        <section className="executions-detail-section">
          <Text as="div" size="1" weight="semibold" tone="muted" className="executions-detail-section__title">Queue</Text>
          <div className="executions-detail-list">
            <DetailRow label="Task status" value={detail.entry.taskStatus ?? "Unknown"} />
            <DetailRow label="Task ID" value={detail.entry.taskId} mono />
          </div>
        </section>
      ) : (
        <RunExecutionDetails execution={detail.entry} actor={actor} />
      )}
    </div>
  );
}

function RunFeedRow({
  feedEntry,
  actor,
  isInterrupting,
  onClick,
  onInterrupt,
}: {
  feedEntry: RunFeedEntry;
  actor?: ActorSummary;
  isInterrupting: boolean;
  onClick: () => void;
  onInterrupt?: () => void;
}) {
  const taskName = feedEntry.entry.taskName ?? "Untitled task";
  const statusDetail = getRunStatusDetail(feedEntry);
  const timeDetail = getRunTimeDetail(feedEntry);
  const agentDetail = actor ? `picked by @${actor.slug ?? actor.displayName ?? actor.id}` : "waiting to be picked";

  return (
    <div
      role="button"
      tabIndex={0}
      className="executions-feed-row"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      aria-label={`Open run for ${taskName}`}
    >
      <RunStatusIcon feedEntry={feedEntry} />
      <div className="executions-feed-row__main">
        <Text as="div" size="3" weight="semibold" wrap>{taskName}</Text>
        <Text as="div" size="2" tone="muted" wrap>{agentDetail}</Text>
      </div>
      <div className="executions-feed-row__meta">
        <Text as="div" size="2" weight="medium">{statusDetail}</Text>
        <Text as="div" size="1" tone="muted">{timeDetail}</Text>
      </div>
      <div className="executions-feed-row__stats">
        <Text as="div" size="2" weight="medium">{getRunToolCount(feedEntry)}</Text>
        <Text as="div" size="1" tone="muted">{getRunTokenCount(feedEntry)}</Text>
      </div>
      {onInterrupt ? (
        <div className="executions-feed-row__actions">
          <Button
            variant="danger"
            size="sm"
            disabled={isInterrupting}
            onClick={(event) => {
              event.stopPropagation();
              onInterrupt();
            }}
          >
            {isInterrupting ? "Interrupting..." : "Interrupt"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RunStatusIcon({ feedEntry }: { feedEntry: RunFeedEntry | ExecutionDetailResult }) {
  if (feedEntry.kind === "queue") {
    return <span className="executions-run-icon executions-run-icon--queued" aria-label="Queued" />;
  }

  if (feedEntry.kind === "active") {
    return <span className="executions-run-icon executions-run-icon--active" aria-label="Active" />;
  }

  if (feedEntry.entry.status === "SUCCEEDED") {
    return <span className="executions-run-icon executions-run-icon--success" aria-label="Succeeded">✓</span>;
  }

  return <span className="executions-run-icon executions-run-icon--danger" aria-label={feedEntry.entry.status}>×</span>;
}

function RunExecutionDetails({ execution, actor }: { execution: ActiveTaskExecutionResponseDto | TaskExecutionHistoryResponseDto; actor?: ActorSummary }) {
  const isHistory = "transitionedAt" in execution;
  const claimedAt = new Date(execution.claimedAt);
  const endTime = isHistory ? new Date(execution.transitionedAt) : new Date();
  const durationText = formatDuration(endTime.getTime() - claimedAt.getTime());
  const stats = execution.stats;

  return (
    <>
      <section className="executions-detail-section">
        <Text as="div" size="1" weight="semibold" tone="muted" className="executions-detail-section__title">Timing</Text>
        <div className="executions-detail-list">
          <DetailRow label="Claimed at" value={formatDateTime(execution.claimedAt)} />
          {isHistory ? <DetailRow label="Finished at" value={formatDateTime(execution.transitionedAt)} /> : null}
          {!isHistory && "lastHeartbeatAt" in execution ? <DetailRow label="Latest heartbeat" value={formatDateTime(execution.lastHeartbeatAt)} /> : null}
          <DetailRow label="Duration" value={durationText} />
        </div>
      </section>

      <section className="executions-detail-section">
        <Text as="div" size="1" weight="semibold" tone="muted" className="executions-detail-section__title">Work</Text>
        <div className="executions-detail-list">
          <DetailRow label="Agent" value={actor ? `@${actor.slug ?? actor.displayName ?? actor.id}` : execution.agentActorId} mono={!actor} />
          <DetailRow label="Tool calls" value={execution.toolCallCount.toLocaleString()} />
          <DetailRow label="Tokens used" value={formatTokenStats(stats)} />
          <DetailRow label="Harness" value={stats?.harness ?? "Unknown"} />
          <DetailRow label="Provider" value={stats?.providerId ?? "Unknown"} />
          <DetailRow label="Model" value={stats?.modelId ?? "Unknown"} />
          <DetailRow label="Worker version" value={stats?.workerVersion ?? "Unknown"} />
        </div>
      </section>

      <section className="executions-detail-section">
        <Text as="div" size="1" weight="semibold" tone="muted" className="executions-detail-section__title">IDs</Text>
        <div className="executions-detail-list">
          <DetailRow label="Run ID" value={execution.id} mono />
          <DetailRow label="Task ID" value={execution.taskId} mono />
          <DetailRow label="Worker ID" value={execution.workerClientId} mono />
          <DetailRow label="Session ID" value={execution.runnerSessionId ?? "pending"} mono />
        </div>
      </section>

      {isHistory && (execution.errorCode || execution.errorMessage) ? (
        <section className="executions-detail-section executions-detail-section--danger">
          <Text as="div" size="1" weight="semibold" tone="muted" className="executions-detail-section__title">Failure</Text>
          <div className="executions-detail-list">
            <DetailRow label="Error code" value={execution.errorCode ?? "None"} />
            {execution.errorMessage ? <DetailRow label="Message" value={execution.errorMessage} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="executions-detail-row">
      <Text as="span" size="1" tone="muted">{label}</Text>
      <Text as="span" size="2" style={mono ? "mono" : "sans"} wrap>{value}</Text>
    </div>
  );
}

function getActorForRun(feedEntry: RunFeedEntry | ExecutionDetailResult, actors: ActorSummary[]) {
  if (feedEntry.kind === "queue") {
    return undefined;
  }

  return actors.find((candidate) => candidate.id === feedEntry.entry.agentActorId);
}

function getRunKey(feedEntry: RunFeedEntry) {
  return feedEntry.kind === "queue" ? `queue-${feedEntry.entry.taskId}` : `${feedEntry.kind}-${feedEntry.entry.id}`;
}

function getRunPath(feedEntry: RunFeedEntry) {
  if (feedEntry.kind === "queue") {
    return `/runs/queue/${feedEntry.entry.taskId}`;
  }

  return `/runs/${feedEntry.kind}/${feedEntry.entry.id}`;
}

function getRunStatusLabel(feedEntry: RunFeedEntry | ExecutionDetailResult) {
  if (feedEntry.kind === "queue") {
    return "Queued";
  }

  if (feedEntry.kind === "active") {
    return "Running";
  }

  return sentenceCase(feedEntry.entry.status);
}

function getRunStatusDetail(feedEntry: RunFeedEntry) {
  if (feedEntry.kind === "queue") {
    return `Queued · ${feedEntry.entry.taskStatus ?? "Unknown task status"}`;
  }

  if (feedEntry.kind === "active") {
    return `Running · ${feedEntry.entry.taskStatus ?? "Unknown task status"}`;
  }

  const error = feedEntry.entry.errorCode ? ` · ${feedEntry.entry.errorCode}` : "";
  return `${sentenceCase(feedEntry.entry.status)}${error}`;
}

function getRunTimeDetail(feedEntry: RunFeedEntry) {
  if (feedEntry.kind === "queue") {
    return shortId(feedEntry.entry.taskId);
  }

  if (feedEntry.kind === "active") {
    return `heartbeat ${formatRelativeTime(feedEntry.entry.lastHeartbeatAt)}`;
  }

  return `${formatDuration(new Date(feedEntry.entry.transitionedAt).getTime() - new Date(feedEntry.entry.claimedAt).getTime())} · ${formatRelativeTime(feedEntry.entry.transitionedAt)}`;
}

function getRunToolCount(feedEntry: RunFeedEntry) {
  if (feedEntry.kind === "queue") {
    return "No tools yet";
  }

  return `${feedEntry.entry.toolCallCount.toLocaleString()} tool calls`;
}

function getRunTokenCount(feedEntry: RunFeedEntry) {
  if (feedEntry.kind === "queue") {
    return "No tokens yet";
  }

  const totalTokens = feedEntry.entry.stats?.totalTokens;
  return totalTokens === null || totalTokens === undefined ? "tokens unknown" : `${totalTokens.toLocaleString()} tokens`;
}

function formatTokenStats(stats: ActiveTaskExecutionResponseDto["stats"] | TaskExecutionHistoryResponseDto["stats"]) {
  if (!stats || stats.totalTokens === null) {
    return "Unknown";
  }

  const input = stats.inputTokens === null ? "unknown" : stats.inputTokens.toLocaleString();
  const output = stats.outputTokens === null ? "unknown" : stats.outputTokens.toLocaleString();
  return `${stats.totalTokens.toLocaleString()} total (${input} input / ${output} output)`;
}

function sentenceCase(value: string) {
  return value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "never";
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaSeconds = Math.max(0, Math.floor(deltaMs / 1000));

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
