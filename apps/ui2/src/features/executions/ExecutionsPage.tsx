import { useEffect, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Text } from "../../ui/primitives";
import { useExecutions, type ExecutionStatus } from "./useExecutions";
import type { Execution } from "./types";
import "./ExecutionsPage.css";

export function ExecutionsPage() {
  const { executions, isLoading, error, loadExecutions } = useExecutions();
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | undefined>(undefined);

  useDocumentTitle();

  useEffect(() => {
    loadExecutions(statusFilter);
  }, [statusFilter, loadExecutions]);

  const handleRefresh = () => {
    loadExecutions(statusFilter);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusClass = (status: ExecutionStatus) => {
    return `status-badge status-${status.toLowerCase()}`;
  };

  return (
    <div className="executions-page">
      <div className="executions-header">
        <Text size="6" weight="bold">Work Queue (Debug)</Text>
        <div className="executions-controls">
          <select
            value={statusFilter || ""}
            onChange={(e) => setStatusFilter((e.target.value || undefined) as ExecutionStatus | undefined)}
            className="status-filter"
          >
            <option value="">All Statuses</option>
            <option value="READY">READY</option>
            <option value="CLAIMED">CLAIMED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="STOP_REQUESTED">STOP_REQUESTED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="STALE">STALE</option>
          </select>
          <button onClick={handleRefresh} className="refresh-button">
            Refresh
          </button>
        </div>
      </div>

      {isLoading && <Text>Loading executions...</Text>}
      {error && <Text className="error-text">Error: {error}</Text>}

      {!isLoading && !error && executions.length === 0 && (
        <Text>No executions found.</Text>
      )}

      {!isLoading && !error && executions.length > 0 && (
        <div className="executions-table-container">
          <table className="executions-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Task</th>
                <th>Agent</th>
                <th>Requested At</th>
                <th>Claimed At</th>
                <th>Started At</th>
                <th>Finished At</th>
                <th>Trigger Reason</th>
                <th>Failure Reason</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution: Execution) => (
                <tr key={execution.id}>
                  <td>
                    <span className={getStatusClass(execution.status as ExecutionStatus)}>
                      {execution.status}
                    </span>
                  </td>
                  <td>
                    <div className="task-cell">
                      <div>{execution.taskName || "Unknown"}</div>
                      <div className="text-muted">
                        {execution.taskId.substring(0, 8)}...
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="agent-cell">
                      {execution.agentName || execution.agentSlug || "Unknown"}
                    </div>
                  </td>
                  <td>
                    {formatDate(execution.requestedAt)}
                  </td>
                  <td>
                    {formatDate(execution.claimedAt)}
                  </td>
                  <td>
                    {formatDate(execution.startedAt)}
                  </td>
                  <td>
                    {formatDate(execution.finishedAt)}
                  </td>
                  <td>
                    <span className="text-muted">
                      {execution.triggerReason || "-"}
                    </span>
                  </td>
                  <td>
                    {execution.failureReason && (
                      <span className="error-text">
                        {execution.failureReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
