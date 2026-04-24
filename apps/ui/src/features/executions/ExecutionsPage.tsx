import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Button, Card, Text } from "../../ui/primitives";
import { useActorsCtx } from "../actors";
import { useExecutions } from "./useExecutions";
import { ExecutionsService } from "./api";
import { useToast } from "../../shared/context/ToastContext";
import { useWorkers } from "../workers/useWorkers";
import type {
  TaskExecutionQueueEntryResponseDto,
  ActiveTaskExecutionResponseDto,
  TaskExecutionHistoryResponseDto,
} from "./types";
import "./ExecutionsPage.css";

type ExecutionDetailResult =
  | { kind: "queue"; entry: TaskExecutionQueueEntryResponseDto }
  | { kind: "active"; entry: ActiveTaskExecutionResponseDto }
  | { kind: "history"; entry: TaskExecutionHistoryResponseDto };

export function ExecutionsPage() {
  const navigate = useNavigate();
  const { actors } = useActorsCtx();
  const { showToast, showError } = useToast();
  const {
    queue,
    active,
    history,
    isLoading,
    hasLoadedOnce,
    error,
    loadExecutions,
  } = useExecutions();
  const { workers } = useWorkers();

  useDocumentTitle();

  // Calculate connected workers (seen in last 2 minutes)
  const connectedWorkersCount = useMemo(() => {
    const now = new Date();
    const twoMinutesMs = 2 * 60 * 1000;
    return workers.filter((worker) => {
      const lastSeen = new Date(worker.lastSeenAt);
      const diffMs = now.getTime() - lastSeen.getTime();
      return diffMs <= twoMinutesMs;
    }).length;
  }, [workers]);

  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [interruptingExecutions, setInterruptingExecutions] = useState<Set<string>>(
    () => new Set(),
  );

  const failedHistory = useMemo(
    () => history.filter((entry) => entry.status !== "SUCCEEDED"),
    [history],
  );
  const successRate = useMemo(() => {
    if (history.length === 0) {
      return "-";
    }

    const succeeded = history.filter((entry) => entry.status === "SUCCEEDED").length;
    return `${Math.round((succeeded / history.length) * 100)}%`;
  }, [history]);

  const toggleHistoryMessage = (historyId: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(historyId)) {
        next.delete(historyId);
      } else {
        next.add(historyId);
      }
      return next;
    });
  };

  const handleInterruptExecution = async (executionId: string, taskName: string | null) => {
    if (!confirm(`Are you sure you want to interrupt the execution for "${taskName ?? "Untitled task"}"?`)) {
      return;
    }

    setInterruptingExecutions((prev) => new Set(prev).add(executionId));

    try {
      await ExecutionsService.ActiveTaskExecutionController_interruptExecution({ executionId });
      showToast(`Interrupt signal sent for "${taskName ?? "Untitled task"}"`);
      // Refresh executions to show updated state
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
        <div className="executions-hero__copy">
          <div className="executions-worker-status">
            <span
              className="executions-worker-status__indicator"
              style={{ color: connectedWorkersCount > 0 ? 'var(--success)' : 'var(--danger)' }}
              aria-label={connectedWorkersCount > 0 ? 'Workers connected' : 'No workers connected'}
            >
              ●
            </span>
            <Text as="span" size="2" tone="muted">
              {connectedWorkersCount > 0
                ? `${connectedWorkersCount} worker${connectedWorkersCount !== 1 ? 's' : ''} connected`
                : 'no worker connected'}
              {' · '}
              <button
                type="button"
                className="executions-worker-status__link"
                onClick={() => navigate('/settings/workers')}
              >
                configure
              </button>
            </Text>
          </div>
        </div>
        {error ? (
          <div className="executions-hero__actions">
            <span className="executions-pill executions-pill--danger">
              Fetch failed
            </span>
          </div>
        ) : null}
      </div>

      {hasLoadedOnce && !error ? (
        <div className="executions-overview" aria-label="Runs overview">
          <OverviewMetric label="Queued" value={String(queue.length)} detail="waiting for a worker" tone="accent" />
          <OverviewMetric label="Active" value={String(active.length)} detail="currently executing" tone="warning" />
          <OverviewMetric label="Failed" value={String(failedHistory.length)} detail="recent failed or cancelled runs" tone={failedHistory.length > 0 ? "danger" : "neutral"} />
          <OverviewMetric label="Success rate" value={successRate} detail="across loaded history" tone="success" />
        </div>
      ) : null}


      {isLoading && !hasLoadedOnce ? (
        <Card className="executions-empty-card">
          <Text as="div" size="3" weight="medium">Loading executions…</Text>
        </Card>
      ) : null}

      {error ? (
        <Card className="executions-empty-card">
          <Text as="div" size="3" weight="medium">Could not load executions</Text>
          <Text as="div" tone="muted" wrap>{error}</Text>
        </Card>
      ) : null}

      {hasLoadedOnce && !error ? (
        <div className="executions-sections">
          <ExecutionSection
            title="Queue"
            subtitle="Runs waiting to be claimed"
            count={queue.length}
            emptyMessage="Nothing is waiting in the queue."
            table={
              <ExecutionTable
                columns={["State", "Task", "Task status", "Task ID", "Run"]}
                rows={queue.map((entry) => ({
                  key: entry.taskId,
                  cells: [
                    <StatusPill key="state" tone="accent">Queued</StatusPill>,
                    <TaskCell key="task" taskId={entry.taskId} taskName={entry.taskName} onClick={() => navigate(`/tasks/task/${entry.taskId}`)} />,
                    <StatusPill key="status" tone={taskStatusTone(entry.taskStatus)}>
                      {entry.taskStatus ?? "Unknown"}
                    </StatusPill>,
                    <CodeCell key="id" value={entry.taskId} />,
                    <RunLink key="run" label="Open run" onClick={() => navigate(`/runs/queue/${entry.taskId}`)} />,
                  ],
                  mobile: (
                    <ExecutionMobileCard
                      key={`queue-mobile-${entry.taskId}`}
                      tone="accent"
                      title={entry.taskName ?? "Untitled task"}
                      badge="Queued"
                      lines={[
                        { label: "Task status", value: entry.taskStatus ?? "Unknown" },
                        { label: "Task ID", value: shortId(entry.taskId), mono: true },
                      ]}
                      onClick={() => navigate(`/tasks/task/${entry.taskId}`)}
                    />
                  ),
                }))}
              />
            }
          />

          <ExecutionSection
            title="Active"
            subtitle="Live agent work with heartbeat and worker details"
            count={active.length}
            emptyMessage="No active executions right now."
            table={
              <ExecutionTable
                columns={["Status", "Task", "Agent", "Heartbeat", "Run", "Actions"]}
                rows={active.map((entry) => {
                  const actor = actors.find((candidate) => candidate.id === entry.agentActorId);
                  const isInterrupting = interruptingExecutions.has(entry.id);

                  return {
                    key: entry.id,
                    expandedContent: expandedHistoryIds.has(entry.id) ? (
                      <ExecutionDetails
                        execution={entry}
                        actor={actor}
                      />
                    ) : null,
                    cells: [
                    <StatusPill key="state" tone="warning"><StatusMark status="ACTIVE" /> Active</StatusPill>,
                    <TaskCellWithStatus
                      key="task"
                      taskId={entry.taskId}
                      taskName={entry.taskName}
                      taskStatus={entry.taskStatus}
                      onClick={() => navigate(`/tasks/task/${entry.taskId}`)}
                    />,
                    <ActorCell
                      key="agent"
                      actorId={entry.agentActorId}
                      actorName={actor?.displayName}
                      actorSlug={actor?.slug}
                    />,
                    <TimeCell key="heartbeat" value={entry.lastHeartbeatAt} />,
                    <RunLink key="run" label="Open run" onClick={() => navigate(`/runs/active/${entry.id}`)} />,
                    <Button
                      key="interrupt"
                      variant="danger"
                      size="sm"
                      disabled={isInterrupting}
                      onClick={() => void handleInterruptExecution(entry.id, entry.taskName)}
                    >
                      {isInterrupting ? "Interrupting…" : "Interrupt"}
                    </Button>,
                    ],
                    mobile: (
                    <ExecutionMobileCard
                      key={`active-mobile-${entry.id}`}
                      tone="warning"
                      title={entry.taskName ?? "Untitled task"}
                      badge="Active"
                      taskStatus={entry.taskStatus}
                      lines={[
                        { label: "Latest heartbeat", value: formatDateTime(entry.lastHeartbeatAt) },
                        { label: "Agent", value: actor?.slug ? `@${actor.slug}` : shortId(entry.agentActorId), mono: true },
                      ]}
                      actionButton={
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isInterrupting}
                          onClick={() => void handleInterruptExecution(entry.id, entry.taskName)}
                        >
                          {isInterrupting ? "Interrupting…" : "Interrupt"}
                        </Button>
                      }
                      onClick={() => navigate(`/tasks/task/${entry.taskId}`)}
                      onToggleDetails={() => toggleHistoryMessage(entry.id)}
                      detailsExpanded={expandedHistoryIds.has(entry.id)}
                      executionDetails={entry}
                      actor={actor}
                    />
                    ),
                  };
                })}
              />
            }
          />

          <ExecutionSection
            title="History"
            subtitle="Completed, failed, and cancelled runs"
            count={history.length}
            emptyMessage="No historical executions yet."
            table={
              <ExecutionTable
                columns={["Status", "Task", "Agent", "Duration", "Run"]}
                rows={history.map((entry) => {
                  const actor = actors.find((candidate) => candidate.id === entry.agentActorId);

                  return {
                    key: entry.id,
                    expandedContent: expandedHistoryIds.has(entry.id) ? (
                      <ExecutionDetails
                        execution={entry}
                        actor={actor}
                      />
                    ) : null,
                    cells: [
                    <StatusCellWithError
                      key="status"
                      status={entry.status}
                      errorCode={entry.errorCode}
                      errorMessage={entry.errorMessage}
                      onToggleDetails={() => toggleHistoryMessage(entry.id)}
                      detailsExpanded={expandedHistoryIds.has(entry.id)}
                    />,
                    <TaskCellWithStatus
                      key="task"
                      taskId={entry.taskId}
                      taskName={entry.taskName}
                      taskStatus={entry.taskStatus}
                      onClick={() => navigate(`/tasks/task/${entry.taskId}`)}
                    />,
                    <ActorCell
                      key="agent"
                      actorId={entry.agentActorId}
                      actorName={actor?.displayName}
                      actorSlug={actor?.slug}
                    />,
                    <DurationCell key="duration" start={entry.claimedAt} end={entry.transitionedAt} />,
                    <RunLink key="run" label="Open run" onClick={() => navigate(`/runs/history/${entry.id}`)} />,
                    ],
                    mobile: (
                    <ExecutionMobileCard
                      key={`history-mobile-${entry.id}`}
                      tone={entry.status === "SUCCEEDED" ? "success" : "danger"}
                      title={entry.taskName ?? "Untitled task"}
                      badge={entry.status}
                      taskStatus={entry.taskStatus}
                      lines={[
                        { label: "Transitioned", value: formatDateTime(entry.transitionedAt) },
                        { label: "Agent", value: actor?.slug ? `@${actor.slug}` : shortId(entry.agentActorId), mono: true },
                        { label: "Error", value: entry.errorCode ?? "None" },
                        ...(entry.errorMessage
                          ? [{ label: "Message", value: entry.errorMessage }]
                          : []),
                      ]}
                      onClick={() => navigate(`/tasks/task/${entry.taskId}`)}
                      onToggleDetails={() => toggleHistoryMessage(entry.id)}
                      detailsExpanded={expandedHistoryIds.has(entry.id)}
                      executionDetails={entry}
                      actor={actor}
                    />
                    ),
                  };
                })}
              />
            }
          />
        </div>
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
          <Text as="div" size="3" weight="medium">Loading run…</Text>
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
      <div className="executions-page">
        <Card className="executions-detail-card">
          <div className="executions-detail-header">
            <div>
              <Text as="div" size="5" weight="bold">Run not found</Text>
              <Text as="div" tone="muted" wrap>The run may have moved between queue, active, and history. Return to the runs list to find the latest state.</Text>
            </div>
            <Button variant="secondary" onClick={() => navigate('/runs')}>Back to runs</Button>
          </div>
        </Card>
      </div>
    );
  }

  const entry = detail.entry;
  const actorId = "agentActorId" in entry ? entry.agentActorId : null;
  const actor = actorId ? actors.find((candidate) => candidate.id === actorId) : undefined;
  const title = entry.taskName ?? "Untitled task";
  let status: string;
  let tone: "accent" | "warning" | "success" | "danger";
  let detailPanel: React.ReactNode;

  if (detail.kind === "queue") {
    status = "QUEUED";
    tone = "accent";
    detailPanel = (
      <div className="executions-details-panel executions-details-panel--standalone">
        <div className="executions-details-grid">
          <div className="executions-details-section">
            <Text as="div" size="1" weight="semibold" tone="muted" className="executions-details-heading">Queue</Text>
            <div className="executions-details-rows">
              <DetailRow label="Task status" value={entry.taskStatus ?? "Unknown"} />
              <DetailRow label="Task ID" value={entry.taskId} mono />
            </div>
          </div>
        </div>
      </div>
    );
  } else if (detail.kind === "active") {
    status = "ACTIVE";
    tone = "warning";
    detailPanel = <ExecutionDetails execution={detail.entry} actor={actor} />;
  } else {
    status = detail.entry.status;
    tone = detail.entry.status === "SUCCEEDED" ? "success" : "danger";
    detailPanel = <ExecutionDetails execution={detail.entry} actor={actor} />;
  }

  return (
    <div className="executions-page executions-page--detail">
      <Card className="executions-detail-card">
        <div className="executions-detail-header">
          <div className="executions-detail-title-group">
            <StatusPill tone={tone}><StatusMark status={status} /> {status}</StatusPill>
            <Text as="div" size="5" weight="bold" wrap>{title}</Text>
            <Text as="div" tone="muted" style="mono">{detail.kind}/{id}</Text>
          </div>
          <div className="executions-detail-actions">
            <Button variant="secondary" onClick={() => navigate(`/tasks/task/${entry.taskId}`)}>Open task</Button>
            <Button variant="secondary" onClick={() => navigate('/runs')}>Back to runs</Button>
          </div>
        </div>

        {detailPanel}
      </Card>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "accent" | "warning" | "success" | "danger" | "neutral";
}) {
  return (
    <Card className={`executions-metric executions-metric--${tone}`}>
      <Text as="div" size="1" tone="muted" className="executions-metric__label">{label}</Text>
      <Text as="div" size="5" weight="bold" className="executions-metric__value">{value}</Text>
      <Text as="div" size="2" tone="muted">{detail}</Text>
    </Card>
  );
}

function ExecutionSection({
  title,
  subtitle,
  count,
  emptyMessage,
  table,
}: {
  title: string;
  subtitle: string;
  count: number;
  emptyMessage: string;
  table: React.ReactNode;
}) {
  return (
    <Card padding="0" className="executions-section-card">
      <div className="executions-section-card__header">
        <div>
          <Text as="div" size="4" weight="bold">{title}</Text>
          <Text as="div" size="2" tone="muted">{subtitle}</Text>
        </div>
        <span className="executions-count-pill">{count}</span>
      </div>
      {count === 0 ? (
        <div className="executions-section-card__empty">
          <Text as="div" tone="muted">{emptyMessage}</Text>
        </div>
      ) : table}
    </Card>
  );
}

function ExecutionTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<{
    key: string;
    cells: React.ReactNode[];
    mobile: React.ReactNode;
    expandedContent?: React.ReactNode;
  }>;
}) {
  return (
    <>
      <div className="executions-table-wrap">
        <table className="executions-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.key}>
                <tr>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${index}`}>{cell}</td>
                  ))}
                </tr>
                {row.expandedContent ? (
                  <tr className="executions-table-detail-row">
                    <td colSpan={columns.length}>{row.expandedContent}</td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="executions-mobile-list">
        {rows.map((row) => row.mobile)}
      </div>
    </>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "accent" | "warning" | "success" | "danger" | "neutral";
}) {
  return (
    <span className={`executions-status-pill executions-status-pill--${tone}`}>
      {children}
    </span>
  );
}

function StatusMark({ status }: { status: string }) {
  if (status === "SUCCEEDED") {
    return <span className="executions-status-mark executions-status-mark--success" aria-hidden="true">✓</span>;
  }

  if (status === "FAILED" || status === "CANCELLED") {
    return <span className="executions-status-mark executions-status-mark--danger" aria-hidden="true">×</span>;
  }

  if (status === "ACTIVE") {
    return <span className="executions-status-mark executions-status-mark--warning" aria-hidden="true">•</span>;
  }

  return <span className="executions-status-mark executions-status-mark--accent" aria-hidden="true">•</span>;
}

function StatusCellWithError({
  status,
  errorCode,
  errorMessage,
  onToggleDetails,
  detailsExpanded,
}: {
  status: TaskExecutionHistoryResponseDto["status"];
  errorCode: TaskExecutionHistoryResponseDto["errorCode"];
  errorMessage: string | null;
  onToggleDetails?: () => void;
  detailsExpanded?: boolean;
}) {
  const hasError = Boolean(errorCode || errorMessage);
  const tone = status === "SUCCEEDED" ? "success" : "danger";

  return (
    <div className="executions-status-with-error">
      <StatusPill tone={tone}><StatusMark status={status} /> {status}</StatusPill>
      {hasError && onToggleDetails && (
        <button
          type="button"
          className="executions-error-indicator"
          onClick={onToggleDetails}
          aria-expanded={detailsExpanded}
          aria-label={detailsExpanded ? "Hide error details" : "Show error details"}
          title={detailsExpanded ? "Hide error details" : "Show error details"}
        >
          !
        </button>
      )}
    </div>
  );
}

function RunLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="executions-details-toggle"
      onClick={onClick}
    >
      <Text as="span" size="2" weight="semibold">{label}</Text>
    </button>
  );
}

function DurationCell({ start, end }: { start: string; end: string }) {
  return (
    <div className="executions-time-cell">
      <Text as="div" size="2" weight="semibold">{formatDuration(new Date(end).getTime() - new Date(start).getTime())}</Text>
      <Text as="div" size="1" tone="muted">{formatRelativeTime(end)}</Text>
    </div>
  );
}

function TaskCell({
  taskId,
  taskName,
  onClick,
}: {
  taskId: string;
  taskName: string | null;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        className="executions-task-cell executions-task-cell--clickable"
        onClick={onClick}
        aria-label={`Navigate to task: ${taskName ?? "Untitled task"}`}
      >
        <Text as="div" size="2" weight="semibold">{taskName ?? "Untitled task"}</Text>
        <Text as="div" size="1" tone="muted" style="mono">{shortId(taskId)}</Text>
      </button>
    );
  }

  return (
    <div className="executions-task-cell">
      <Text as="div" size="2" weight="semibold">{taskName ?? "Untitled task"}</Text>
      <Text as="div" size="1" tone="muted" style="mono">{shortId(taskId)}</Text>
    </div>
  );
}

function TaskCellWithStatus({
  taskId,
  taskName,
  taskStatus,
  onClick,
}: {
  taskId: string;
  taskName: string | null;
  taskStatus: string | null;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Text as="div" size="2" weight="semibold">{taskName ?? "Untitled task"}</Text>
      {taskStatus && (
        <StatusPill tone={taskStatusTone(taskStatus)}>
          {taskStatus}
        </StatusPill>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="executions-task-cell-with-status executions-task-cell--clickable"
        onClick={onClick}
        aria-label={`Navigate to task: ${taskName ?? "Untitled task"}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="executions-task-cell-with-status">
      {content}
    </div>
  );
}

function CodeCell({ value }: { value: string }) {
  return (
    <Text as="span" size="1" style="mono" className="executions-code-copy">
      {shortId(value)}
    </Text>
  );
}

function ActorCell({
  actorId,
  actorName,
  actorSlug,
}: {
  actorId: string;
  actorName?: string;
  actorSlug?: string;
}) {
  return (
    <div className="executions-actor-cell">
      <Text as="div" size="2" weight="semibold">{actorName ?? shortId(actorId)}</Text>
      <Text as="div" size="1" tone="muted" style="mono" className="executions-actor-slug">
        {actorSlug ? `@${actorSlug}` : shortId(actorId)}
      </Text>
    </div>
  );
}

function ErrorCell({
  errorCode,
  errorMessage,
  expanded,
  onToggle,
}: {
  errorCode: TaskExecutionHistoryResponseDto["errorCode"];
  errorMessage: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasMessage = Boolean(errorMessage);

  return (
    <div className="executions-error-cell">
      <span className={errorCode ? "executions-error-copy" : "executions-muted-copy"}>
        {errorCode ?? "None"}
      </span>
      {hasMessage ? (
        <button
          type="button"
          className="executions-error-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide error message" : "Show error message"}
          title={expanded ? "Hide error message" : "Show error message"}
        >
          !
        </button>
      ) : null}
    </div>
  );
}

function ExecutionErrorMessage({
  status,
  message,
}: {
  status: TaskExecutionHistoryResponseDto["status"];
  message: string;
}) {
  return (
    <div className="executions-error-detail">
      <Text
        as="div"
        size="1"
        weight="medium"
        tone={status === "CANCELLED" ? "muted" : "default"}
        className={status === "CANCELLED" ? undefined : "executions-error-detail__label"}
      >
        {status === "CANCELLED" ? "Cancellation message" : "Failure message"}
      </Text>
      <Text as="div" size="2" wrap>{message}</Text>
    </div>
  );
}

function ExecutionDetails({
  execution,
  actor,
}: {
  execution: ActiveTaskExecutionResponseDto | TaskExecutionHistoryResponseDto;
  actor?: { id: string; displayName?: string; slug?: string };
}) {
  const isHistory = "transitionedAt" in execution;
  const claimedAt = new Date(execution.claimedAt);
  const endTime = isHistory ? new Date(execution.transitionedAt) : new Date();
  const durationMs = endTime.getTime() - claimedAt.getTime();
  const durationText = formatDuration(durationMs);

  return (
    <div className="executions-details-panel">
      <div className="executions-details-grid">
        <div className="executions-details-section">
          <Text as="div" size="1" weight="semibold" tone="muted" className="executions-details-heading">
            Timing
          </Text>
          <div className="executions-details-rows">
            <DetailRow label="Claimed at" value={formatDateTime(execution.claimedAt)} />
            {isHistory && (
              <>
                <DetailRow label="Finished at" value={formatDateTime(execution.transitionedAt)} />
                <DetailRow label="Duration" value={durationText} />
              </>
            )}
            {!isHistory && "lastHeartbeatAt" in execution && (
              <DetailRow label="Latest heartbeat" value={formatDateTime(execution.lastHeartbeatAt)} />
            )}
          </div>
        </div>

        {execution.stats && (
          <div className="executions-details-section">
            <Text as="div" size="1" weight="semibold" tone="muted" className="executions-details-heading">
              Execution Stats
            </Text>
            <div className="executions-details-rows">
              {execution.stats.harness && (
                <DetailRow label="Harness" value={execution.stats.harness} />
              )}
              {execution.stats.providerId && (
                <DetailRow label="Provider" value={execution.stats.providerId} />
              )}
              {execution.stats.modelId && (
                <DetailRow label="Model" value={execution.stats.modelId} />
              )}
              {execution.stats.totalTokens !== null && (
                <DetailRow
                  label="Tokens"
                  value={`${execution.stats.totalTokens.toLocaleString()} (${execution.stats.inputTokens?.toLocaleString() ?? 0} in / ${execution.stats.outputTokens?.toLocaleString() ?? 0} out)`}
                />
              )}
            </div>
          </div>
        )}

        <div className="executions-details-section">
          <Text as="div" size="1" weight="semibold" tone="muted" className="executions-details-heading">
            System Info
          </Text>
          <div className="executions-details-rows">
            <DetailRow label="Worker ID" value={shortId(execution.workerClientId)} mono />
            <DetailRow label="Session ID" value={formatSession(execution.runnerSessionId)} mono />
            <DetailRow label="Tool calls" value={String(execution.toolCallCount)} />
          </div>
        </div>

        {isHistory && execution.errorMessage && (
          <div className="executions-details-section executions-details-section--full">
            <ExecutionErrorMessage
              status={execution.status}
              message={execution.errorMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="executions-detail-row">
      <Text as="span" size="1" tone="muted">{label}</Text>
      <Text as="span" size="2" style={mono ? "mono" : "sans"}>{value}</Text>
    </div>
  );
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

function TimeCell({ value }: { value: string | null }) {
  return (
    <div className="executions-time-cell">
      <Text as="div" size="2">{formatDateTime(value)}</Text>
      {value ? (
        <Text as="div" size="1" tone="muted">
          {formatRelativeTime(value)}
        </Text>
      ) : null}
    </div>
  );
}

function SessionCell({ value }: { value: string | null }) {
  return (
    <Text as="span" size="1" style="mono" className="executions-code-copy">
      {formatSession(value)}
    </Text>
  );
}

function ToolCountCell({ value }: { value: number }) {
  return (
    <Text as="span" size="2" weight="semibold">
      {value}
    </Text>
  );
}

function ExecutionMobileCard({
  title,
  badge,
  tone,
  taskStatus,
  lines,
  onClick,
  actionButton,
  onToggleDetails,
  detailsExpanded,
  executionDetails,
  actor,
}: {
  title: string;
  badge: string;
  tone: "accent" | "warning" | "success" | "danger";
  taskStatus?: string | null;
  lines: Array<{ label: string; value: string; mono?: boolean }>;
  onClick?: () => void;
  actionButton?: React.ReactNode;
  onToggleDetails?: () => void;
  detailsExpanded?: boolean;
  executionDetails?: ActiveTaskExecutionResponseDto | TaskExecutionHistoryResponseDto;
  actor?: { id: string; displayName?: string; slug?: string };
}) {
  // When we have both onClick and other interactive elements (actionButton or details toggle),
  // render as div to avoid nested interactive elements. Only the header becomes clickable for navigation.
  const hasOtherInteractiveElements = actionButton || onToggleDetails;

  if (onClick && hasOtherInteractiveElements) {
    return (
      <div className="executions-mobile-card">
        <button
          type="button"
          className="executions-mobile-card__header executions-mobile-card__header--clickable"
          onClick={onClick}
          aria-label={`Navigate to task: ${title}`}
        >
          <div className="executions-mobile-card__title-group">
            <Text as="div" size="3" weight="semibold" wrap>{title}</Text>
            {taskStatus && (
              <StatusPill tone={taskStatusTone(taskStatus)}>
                {taskStatus}
              </StatusPill>
            )}
          </div>
          <StatusPill tone={tone}>{badge}</StatusPill>
        </button>
        <div className="executions-mobile-card__body">
          {lines.map((line) => (
            <div key={`${badge}-${line.label}`} className="executions-mobile-card__row">
              <Text as="span" size="1" tone="muted">{line.label}</Text>
              <Text
                as="span"
                size="2"
                style={line.mono ? "mono" : "sans"}
                className={line.label === "Error" && line.value !== "None" ? "executions-error-copy" : ""}
              >
                {line.value}
              </Text>
            </div>
          ))}
        </div>
        {onToggleDetails && executionDetails && (
          <>
            <button
              type="button"
              className="executions-mobile-details-toggle"
              onClick={onToggleDetails}
              aria-expanded={detailsExpanded}
            >
              <Text as="span" size="2" weight="semibold">
                {detailsExpanded ? "Hide details" : "Show details"}
              </Text>
            </button>
            {detailsExpanded && (
              <ExecutionDetails execution={executionDetails} actor={actor} />
            )}
          </>
        )}
        {actionButton && (
          <div className="executions-mobile-card__actions">
            {actionButton}
          </div>
        )}
      </div>
    );
  }

  const className = onClick
    ? "executions-mobile-card executions-mobile-card--clickable"
    : "executions-mobile-card";

  const CardContent = (
    <>
      <div className="executions-mobile-card__header">
        <div className="executions-mobile-card__title-group">
          <Text as="div" size="3" weight="semibold" wrap>{title}</Text>
          {taskStatus && (
            <StatusPill tone={taskStatusTone(taskStatus)}>
              {taskStatus}
            </StatusPill>
          )}
        </div>
        <StatusPill tone={tone}>{badge}</StatusPill>
      </div>
      <div className="executions-mobile-card__body">
        {lines.map((line) => (
          <div key={`${badge}-${line.label}`} className="executions-mobile-card__row">
            <Text as="span" size="1" tone="muted">{line.label}</Text>
            <Text
              as="span"
              size="2"
              style={line.mono ? "mono" : "sans"}
              className={line.label === "Error" && line.value !== "None" ? "executions-error-copy" : ""}
            >
              {line.value}
            </Text>
          </div>
        ))}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`Navigate to task: ${title}`}
      >
        {CardContent}
      </button>
    );
  }

  return (
    <div className={className}>
      {CardContent}
    </div>
  );
}

function taskStatusTone(
  status: string | null,
): "accent" | "warning" | "success" | "danger" | "neutral" {
  switch (status) {
    case "NOT_STARTED":
      return "accent";
    case "IN_PROGRESS":
      return "warning";
    case "FOR_REVIEW":
      return "warning";
    case "DONE":
      return "success";
    case null:
      return "neutral";
    default:
      return "neutral";
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function formatRelativeTime(value: string) {
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
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatSession(value: string | null): string {
  if (!value) {
    return 'pending';
  }

  return shortId(value);
}
