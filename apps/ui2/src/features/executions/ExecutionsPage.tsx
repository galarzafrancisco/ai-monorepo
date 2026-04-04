import { useMemo } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Button, Card, Text } from "../../ui/primitives";
import { useExecutions } from "./useExecutions";
import type {
  TaskExecutionQueueEntryResponseDto,
  ActiveTaskExecutionResponseDto,
  TaskExecutionHistoryResponseDto,
} from "./types";
import "./ExecutionsPage.css";

export function ExecutionsPage() {
  const {
    queue,
    active,
    history,
    isLoading,
    isRefreshing,
    hasLoadedOnce,
    error,
    loadExecutions,
  } = useExecutions();

  useDocumentTitle();

  const historySuccessCount = useMemo(
    () => history.filter((entry) => entry.status === "SUCCEEDED").length,
    [history],
  );
  const historyFailureCount = history.length - historySuccessCount;

  return (
    <div className="executions-page">
      <div className="executions-hero">
        <div className="executions-hero__copy">
          <Text as="div" size="6" weight="bold">Execution Monitor</Text>
          <Text as="div" size="3" tone="muted" wrap>
            Queue, active work, and recent history in one place. The view refreshes automatically every 5 seconds.
          </Text>
        </div>
        <div className="executions-hero__actions">
          <span className={`executions-pill ${error ? "executions-pill--danger" : "executions-pill--success"}`}>
            {error ? "Fetch failed" : isRefreshing ? "Refreshing" : "Polling"}
          </span>
          <Button variant="secondary" onClick={() => void loadExecutions()} disabled={isRefreshing}>
            Refresh now
          </Button>
        </div>
      </div>

      <div className="executions-summary-grid">
        <SummaryCard label="Queued" value={queue.length} tone="accent" />
        <SummaryCard label="Active" value={active.length} tone="warning" />
        <SummaryCard label="Succeeded" value={historySuccessCount} tone="success" />
        <SummaryCard label="Failed" value={historyFailureCount} tone="danger" />
      </div>


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
            subtitle=""
            count={queue.length}
            emptyMessage="Nothing is waiting in the queue."
            table={
              <ExecutionTable
                columns={["State", "Task", "Task status", "Task ID"]}
                rows={queue.map((entry) => ({
                  key: entry.taskId,
                  cells: [
                    <StatusPill key="state" tone="accent">Queued</StatusPill>,
                    <TaskCell key="task" taskId={entry.taskId} taskName={entry.taskName} />,
                    <StatusPill key="status" tone={taskStatusTone(entry.taskStatus)}>
                      {entry.taskStatus ?? "Unknown"}
                    </StatusPill>,
                    <CodeCell key="id" value={entry.taskId} />,
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
                    />
                  ),
                }))}
              />
            }
          />

          <ExecutionSection
            title="Active"
            subtitle=""
            count={active.length}
            emptyMessage="No active executions right now."
            table={
              <ExecutionTable
                columns={["State", "Task", "Worker", "Agent", "Claimed", "Latest heartbeat", "Before claim"]}
                rows={active.map((entry) => ({
                  key: entry.id,
                  cells: [
                    <StatusPill key="state" tone="warning">Active</StatusPill>,
                    <TaskCell key="task" taskId={entry.taskId} taskName={entry.taskName} />,
                    <CodeCell key="worker" value={entry.workerClientId} />,
                    <CodeCell key="agent" value={entry.agentActorId} />,
                    <TimeCell key="claimed" value={entry.claimedAt} />,
                    <TimeCell key="heartbeat" value={entry.lastHeartbeatAt} />,
                    <StatusPill key="before" tone={taskStatusTone(entry.taskStatusBeforeClaim)}>
                      {entry.taskStatusBeforeClaim}
                    </StatusPill>,
                  ],
                  mobile: (
                    <ExecutionMobileCard
                      key={`active-mobile-${entry.id}`}
                      tone="warning"
                      title={entry.taskName ?? "Untitled task"}
                      badge="Active"
                      lines={[
                        { label: "Claimed", value: formatDateTime(entry.claimedAt) },
                        { label: "Latest heartbeat", value: formatDateTime(entry.lastHeartbeatAt) },
                        { label: "Worker", value: shortId(entry.workerClientId), mono: true },
                        { label: "Agent", value: shortId(entry.agentActorId), mono: true },
                        { label: "Before claim", value: entry.taskStatusBeforeClaim },
                      ]}
                    />
                  ),
                }))}
              />
            }
          />

          <ExecutionSection
            title="History"
            subtitle=""
            count={history.length}
            emptyMessage="No historical executions yet."
            table={
              <ExecutionTable
                columns={["Result", "Task", "Transitioned", "Task status", "Worker", "Error"]}
                rows={history.map((entry) => ({
                  key: entry.id,
                  cells: [
                    <StatusPill key="result" tone={entry.status === "SUCCEEDED" ? "success" : "danger"}>
                      {entry.status}
                    </StatusPill>,
                    <TaskCell key="task" taskId={entry.taskId} taskName={entry.taskName} />,
                    <TimeCell key="transitioned" value={entry.transitionedAt} />,
                    <StatusPill key="task-status" tone={taskStatusTone(entry.taskStatus)}>
                      {entry.taskStatus ?? "Unknown"}
                    </StatusPill>,
                    <CodeCell key="worker" value={entry.workerClientId} />,
                    <span key="error" className={entry.errorCode ? "executions-error-copy" : "executions-muted-copy"}>
                      {entry.errorCode ?? "None"}
                    </span>,
                  ],
                  mobile: (
                    <ExecutionMobileCard
                      key={`history-mobile-${entry.id}`}
                      tone={entry.status === "SUCCEEDED" ? "success" : "danger"}
                      title={entry.taskName ?? "Untitled task"}
                      badge={entry.status}
                      lines={[
                        { label: "Transitioned", value: formatDateTime(entry.transitionedAt) },
                        { label: "Task status", value: entry.taskStatus ?? "Unknown" },
                        { label: "Worker", value: shortId(entry.workerClientId), mono: true },
                        { label: "Error", value: entry.errorCode ?? "None" },
                      ]}
                    />
                  ),
                }))}
              />
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "accent" | "warning" | "success" | "danger";
}) {
  return (
    <Card className={`executions-summary-card executions-summary-card--${tone}`}>
      <Text as="div" size="2" tone="muted" weight="medium">{label}</Text>
      <Text as="div" size="6" weight="bold">{value}</Text>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="executions-metric">
      <Text as="div" size="1" tone="muted" weight="medium">{label}</Text>
      <Text as="div" size="3" weight="semibold">{value}</Text>
    </div>
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
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${index}`}>{cell}</td>
                ))}
              </tr>
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

function TaskCell({
  taskId,
  taskName,
}: {
  taskId: string;
  taskName: string | null;
}) {
  return (
    <div className="executions-task-cell">
      <Text as="div" size="2" weight="semibold">{taskName ?? "Untitled task"}</Text>
      <Text as="div" size="1" tone="muted" style="mono">{shortId(taskId)}</Text>
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

function ExecutionMobileCard({
  title,
  badge,
  tone,
  lines,
}: {
  title: string;
  badge: string;
  tone: "accent" | "warning" | "success" | "danger";
  lines: Array<{ label: string; value: string; mono?: boolean }>;
}) {
  return (
    <div className="executions-mobile-card">
      <div className="executions-mobile-card__header">
        <Text as="div" size="3" weight="semibold" wrap>{title}</Text>
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
