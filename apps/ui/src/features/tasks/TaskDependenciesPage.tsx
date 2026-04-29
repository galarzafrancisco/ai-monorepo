import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Text } from "../../ui/primitives";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { TaskStatus, TASKS_STATUS } from "./const";
import { useTasksCtx } from "./TasksProvider";
import type { Task } from "./types";
import { useExecutions } from "../executions/useExecutions";
import "./TaskDependenciesPage.css";

type GraphConnection = {
  taskId: string;
  blockerId: string;
  taskIndex: number;
  blockerIndex: number;
};

const CARD_HEIGHT = 76;
const CARD_GAP = 14;

export function TaskDependenciesPage(): React.JSX.Element {
  const { tasks, isLoading, error, setSectionTitle, activityByTaskId } = useTasksCtx();
  const { active } = useExecutions();
  const navigate = useNavigate();

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("Dependencies");
  }, [setSectionTitle]);

  const graph = useMemo(() => buildDependencyGraph(tasks), [tasks]);
  const activeTaskIds = useMemo(() => new Set(active.map((execution) => execution.taskId)), [active]);

  if (isLoading && tasks.length === 0) {
    return (
      <div className="task-dependencies-page task-dependencies-page--state">
        <Text tone="muted">Loading dependencies...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="task-dependencies-page task-dependencies-page--state">
        <Text tone="muted">Could not load dependencies: {error}</Text>
      </div>
    );
  }

  return (
    <div className="task-dependencies-page">
      <div className="task-dependencies-canvas" aria-label="Task dependency graph">
        {graph.dependentTasks.length === 0 ? (
          <div className="task-dependencies-empty">
            <Text size="3" weight="semibold">No dependency graph yet</Text>
            <Text tone="muted">Add dependencies to tasks and they will appear here as task-to-blocker connections.</Text>
          </div>
        ) : (
          <>
            <GraphColumn title="Tasks with dependencies" tasks={graph.dependentTasks} activityByTaskId={activityByTaskId} activeTaskIds={activeTaskIds} onOpenTask={(taskId) => navigate(`/tasks/task/${taskId}`)} />
            <ConnectionLayer connections={graph.connections} leftCount={graph.dependentTasks.length} rightCount={graph.blockerTasks.length} />
            <GraphColumn title="Blocking tasks" tasks={graph.blockerTasks} activityByTaskId={activityByTaskId} activeTaskIds={activeTaskIds} align="right" onOpenTask={(taskId) => navigate(`/tasks/task/${taskId}`)} />
          </>
        )}
      </div>
    </div>
  );
}

function GraphColumn({
  title,
  tasks,
  activityByTaskId,
  activeTaskIds,
  align = "left",
  onOpenTask,
}: {
  title: string;
  tasks: Task[];
  activityByTaskId: Record<string, unknown>;
  activeTaskIds: Set<string>;
  align?: "left" | "right";
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section className={`task-dependencies-column task-dependencies-column--${align}`}>
      <div className="task-dependencies-column__header">
        <Text size="2" weight="semibold">{title}</Text>
        <Text size="1" tone="muted">{tasks.length}</Text>
      </div>
      <div className="task-dependencies-column__cards">
        {tasks.map((task) => (
          <DependencyTaskCard key={task.id} task={task} hasActiveExecution={activeTaskIds.has(task.id) || Boolean(activityByTaskId[task.id])} onOpen={() => onOpenTask(task.id)} />
        ))}
      </div>
    </section>
  );
}

function DependencyTaskCard({ task, hasActiveExecution, onOpen }: { task: Task; hasActiveExecution: boolean; onOpen: () => void }) {
  return (
    <button className={`dependency-task-card dependency-task-card--${task.status.toLowerCase().replaceAll("_", "-")}`} type="button" onClick={onOpen}>
      <StatusIndicator status={task.status as TaskStatus} />
      <span className="dependency-task-card__title">{task.name}</span>
      {hasActiveExecution ? <span className="dependency-task-card__spinner" aria-label="Active execution" /> : null}
    </button>
  );
}

function StatusIndicator({ status }: { status: TaskStatus }) {
  const label = TASKS_STATUS[status].label;
  return (
    <span className={`dependency-status-indicator dependency-status-indicator--${status.toLowerCase().replaceAll("_", "-")}`} aria-label={label} title={label}>
      {status === TaskStatus.DONE ? <Check size={12} strokeWidth={2.5} /> : null}
    </span>
  );
}

function ConnectionLayer({ connections, leftCount, rightCount }: { connections: GraphConnection[]; leftCount: number; rightCount: number }) {
  const rowCount = Math.max(leftCount, rightCount);
  const height = rowCount * CARD_HEIGHT + Math.max(rowCount - 1, 0) * CARD_GAP;

  return (
    <svg className="task-dependencies-connections" viewBox={`0 0 320 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {connections.map((connection) => {
        const startY = connection.taskIndex * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2;
        const endY = connection.blockerIndex * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2;
        return (
          <path
            key={`${connection.taskId}-${connection.blockerId}`}
            d={`M 0 ${startY} C 120 ${startY}, 200 ${endY}, 320 ${endY}`}
            className="task-dependencies-connection"
          />
        );
      })}
    </svg>
  );
}

function buildDependencyGraph(tasks: Task[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dependentTasks = tasks.filter((task) => task.dependsOnIds.length > 0);
  const blockerIdSet = new Set(dependentTasks.flatMap((task) => task.dependsOnIds));
  const blockerTasks = Array.from(blockerIdSet)
    .map((id) => taskById.get(id))
    .filter((task): task is Task => Boolean(task));
  const blockerIndexById = new Map(blockerTasks.map((task, index) => [task.id, index]));

  const connections = dependentTasks.flatMap((task, taskIndex) =>
    task.dependsOnIds.flatMap((blockerId) => {
      const blockerIndex = blockerIndexById.get(blockerId);
      if (blockerIndex === undefined) return [];
      return [{ taskId: task.id, blockerId, taskIndex, blockerIndex }];
    }),
  );

  return { dependentTasks, blockerTasks, connections };
}
