import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Avatar, Button, Chip, Text } from "../../ui/primitives";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { isDeactivated, useActorsCtx } from "../actors";
import { RunTrace } from "../tasks/traces/RunTrace";
import { runStatusTag, type TraceRun } from "../tasks/traces/runs";
import { useExecutions } from "./useExecutions";
import "./RunTracePage.css";

/**
 * A run's trace on its own page, with all the room it needs. Linked from the
 * task's Runs panel ("Full view"), from a run's details, and from the task's
 * runs list on phones.
 */
export function RunTracePage() {
  const navigate = useNavigate();
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const { actors } = useActorsCtx();
  const { active, history, loadExecutions } = useExecutions();

  // The run's summary comes from the runs feed when it's there; the trace itself
  // only needs the id, so an older run outside the feed still shows its trace.
  const finished = useMemo(() => history.find((candidate) => candidate.id === id) ?? null, [history, id]);
  const entry = useMemo(() => {
    if (kind === "active") return active.find((candidate) => candidate.id === id) ?? null;
    if (kind === "history") return finished;
    return null;
  }, [active, finished, id, kind]);

  // A live run that has finished moves into history under the same id: follow it there.
  useEffect(() => {
    if (kind === "active" && finished) navigate(`/runs/history/${id}/traces`, { replace: true });
  }, [finished, id, kind, navigate]);

  const run = useMemo<TraceRun | null>(() => {
    if (!id || (kind !== "active" && kind !== "history")) return null;
    return {
      executionId: id,
      agentActorId: entry?.agentActorId ?? "",
      status: entry && "status" in entry ? entry.status : "ACTIVE",
      source: kind,
      timestamp: entry ? ("transitionedAt" in entry ? entry.transitionedAt : entry.claimedAt) : "",
    };
  }, [entry, id, kind]);

  useDocumentTitle();
  const onRunsChanged = useCallback(() => { void loadExecutions({ silent: true }); }, [loadExecutions]);

  if (!run) {
    return (
      <div className="run-trace-page">
        <Text as="div" size="5" weight="bold">Trace not found</Text>
        <Button variant="secondary" onClick={() => navigate("/runs")}>Back to runs</Button>
      </div>
    );
  }

  const actor = actors.find((candidate) => candidate.id === run.agentActorId);
  const tag = runStatusTag(run);

  return (
    <div className="run-trace-page">
      <header className="run-trace-page__header">
        <Button
          variant="ghost"
          size="sm"
          className="run-trace-page__back"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(entry ? `/tasks/task/${entry.taskId}` : "/runs"))}
        >
          <ArrowLeft size={18} />
          Back
        </Button>
        <div className="run-trace-page__summary">
          {actor && <Avatar size="sm" name={actor.displayName} inactive={isDeactivated(actor)} src={actor.avatarUrl || undefined} />}
          <div className="run-trace-page__copy">
            <Text as="div" size="3" weight="semibold" wrap>{entry?.taskName ?? "Run trace"}</Text>
            <Text as="div" size="1" tone="muted">
              {actor?.displayName ?? "Agent"}
              {run.timestamp ? ` · ${elapsedTime(run.timestamp)}` : ""}
              {` · #${run.executionId.slice(0, 6)}`}
            </Text>
          </div>
          <Chip color={tag.color}>{tag.label}</Chip>
        </div>
        <div className="run-trace-page__links">
          {entry && <Button variant="secondary" size="sm" onClick={() => navigate(`/tasks/task/${entry.taskId}`)}>Open task</Button>}
          <Button variant="secondary" size="sm" onClick={() => navigate(`/runs/${kind}/${id}`)}>Run details</Button>
        </div>
      </header>
      <div className="run-trace-page__trace task-traces">
        <RunTrace run={run} onRunsChanged={onRunsChanged} />
      </div>
    </div>
  );
}
