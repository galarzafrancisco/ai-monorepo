import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Chip, ListRow, Row, Stack, Text } from "../../ui/primitives";
import { useHomeCtx } from "./HomeProvider";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { TasksService } from "../tasks/api";
import { Task } from "../tasks/types";
import { TaskStatus, TASKS_STATUS } from "../tasks/const";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useAuth } from "../../auth/AuthContext";
import "./HomePage.css";

const TASKS_PAGE_SIZE = 100;

const STATUS_ORDER = [
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.FOR_REVIEW,
  TaskStatus.DONE,
];

export function HomePage() {
  const navigate = useNavigate();
  const { setSectionTitle } = useHomeCtx();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("Home");
  }, [setSectionTitle]);

  useEffect(() => {
    let active = true;
    const loadTasks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await TasksService.tasksControllerListTasks(undefined, undefined, undefined, 1, TASKS_PAGE_SIZE);
        if (!active) {
          return;
        }
        setTasks(response.items ?? []);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadTasks();
    return () => {
      active = false;
    };
  }, []);

  const taskCounts = useMemo(() => {
    return STATUS_ORDER.reduce<Record<TaskStatus, number>>((acc, status) => {
      acc[status] = tasks.filter(task => task.status === status).length;
      return acc;
    }, {
      [TaskStatus.NOT_STARTED]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.FOR_REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    });
  }, [tasks]);

  const needsInputTasks = useMemo(() => {
    return tasks.filter(task => task.inputRequests?.some(request => {
      const isOpen = !request.resolvedAt;
      if (!isOpen) {
        return false;
      }
      if (!user) {
        return true;
      }
      return request.assignedToActorId === user.actorId;
    }));
  }, [tasks, user]);

  const reviewTasks = useMemo(() => {
    return tasks.filter(task => task.status === TaskStatus.FOR_REVIEW);
  }, [tasks]);

  const inProgressTasks = useMemo(() => {
    return tasks.filter(task => task.status === TaskStatus.IN_PROGRESS);
  }, [tasks]);

  const recentTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    }).slice(0, 6);
  }, [tasks]);

  return (
    <div className="home-page">
      <div className="home-page__hero">
        <Stack spacing="3">
          <Text size="6" weight="bold">Command Center</Text>
          <Text size="3" tone="muted">
            A quick pulse on tasks waiting for you, active builds, and review queues.
          </Text>
          <Row className="home-page__hero-actions" spacing="2">
            <Button onClick={() => navigate("/tasks")}>
              Go to tasks
            </Button>
            <Button variant="secondary" onClick={() => navigate("/agents")}>Agents</Button>
            <Button variant="secondary" onClick={() => navigate("/context")}>Context</Button>
          </Row>
        </Stack>
        <Card className="home-page__hero-card">
          <Stack spacing="3">
            <Text size="4" weight="semibold">Today’s focus</Text>
            <Text tone="muted">
              {needsInputTasks.length > 0
                ? `${needsInputTasks.length} task${needsInputTasks.length === 1 ? "" : "s"} waiting on input.`
                : "No open input requests. You’re clear to build."}
            </Text>
            <Row spacing="2">
              <Chip color={needsInputTasks.length > 0 ? "orange" : "green"}>
                {needsInputTasks.length > 0 ? "Needs input" : "All clear"}
              </Chip>
              <Chip color={reviewTasks.length > 0 ? "purple" : "gray"}>
                {reviewTasks.length > 0 ? `${reviewTasks.length} ready to review` : "No reviews"}
              </Chip>
            </Row>
          </Stack>
        </Card>
      </div>

      <div className="home-page__status-grid">
        {STATUS_ORDER.map(status => {
          const info = TASKS_STATUS[status];
          return (
            <button
              key={status}
              className="home-status-card"
              type="button"
              onClick={() => navigate(info.path)}
            >
              <Card className="home-status-card__inner">
                <Text size="1" tone="muted">{info.icon} {info.label}</Text>
                <Text size="5" weight="bold">{taskCounts[status]}</Text>
              </Card>
            </button>
          );
        })}
      </div>

      {error ? (
        <Card className="home-page__notice">
          <Text tone="muted">Error loading tasks: {error}</Text>
        </Card>
      ) : null}

      {isLoading && tasks.length === 0 ? (
        <Card className="home-page__notice">
          <Text tone="muted">Loading task activity…</Text>
        </Card>
      ) : null}

      <div className="home-page__grid">
        <Card className="home-panel">
          <Stack spacing="3">
            <Row justify="space-between" align="center">
              <Text size="3" weight="semibold">Needs your input</Text>
              <Button size="sm" variant="ghost" onClick={() => navigate("/tasks")}>Open</Button>
            </Row>
            <div className="home-list">
              {needsInputTasks.length === 0 ? (
                <Text tone="muted">No tasks waiting on your input.</Text>
              ) : (
                needsInputTasks.slice(0, 5).map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    chipLabel="Input"
                    chipColor="orange"
                    onClick={() => navigate(`/tasks/task/${task.id}`)}
                  />
                ))
              )}
            </div>
          </Stack>
        </Card>

        <Card className="home-panel">
          <Stack spacing="3">
            <Row justify="space-between" align="center">
              <Text size="3" weight="semibold">Ready for review</Text>
              <Button size="sm" variant="ghost" onClick={() => navigate("/tasks/in-review")}>Review</Button>
            </Row>
            <div className="home-list">
              {reviewTasks.length === 0 ? (
                <Text tone="muted">No tasks ready to review.</Text>
              ) : (
                reviewTasks.slice(0, 5).map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    chipLabel="Review"
                    chipColor="purple"
                    onClick={() => navigate(`/tasks/task/${task.id}`)}
                  />
                ))
              )}
            </div>
          </Stack>
        </Card>

        <Card className="home-panel">
          <Stack spacing="3">
            <Row justify="space-between" align="center">
              <Text size="3" weight="semibold">In progress</Text>
              <Button size="sm" variant="ghost" onClick={() => navigate("/tasks/in-progress")}>View</Button>
            </Row>
            <div className="home-list">
              {inProgressTasks.length === 0 ? (
                <Text tone="muted">No active builds right now.</Text>
              ) : (
                inProgressTasks.slice(0, 5).map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    chipLabel="Build"
                    chipColor="green"
                    onClick={() => navigate(`/tasks/task/${task.id}`)}
                  />
                ))
              )}
            </div>
          </Stack>
        </Card>

        <Card className="home-panel">
          <Stack spacing="3">
            <Row justify="space-between" align="center">
              <Text size="3" weight="semibold">Recent activity</Text>
              <Button size="sm" variant="ghost" onClick={() => navigate("/tasks")}>All tasks</Button>
            </Row>
            <div className="home-list">
              {recentTasks.length === 0 ? (
                <Text tone="muted">No recent task activity yet.</Text>
              ) : (
                recentTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    chipLabel={TASKS_STATUS[task.status].label}
                    chipColor={statusToChipColor(task.status)}
                    onClick={() => navigate(`/tasks/task/${task.id}`)}
                  />
                ))
              )}
            </div>
          </Stack>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  chipLabel,
  chipColor,
  onClick,
}: {
  task: Task;
  chipLabel: string;
  chipColor: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";
  onClick: () => void;
}) {
  return (
    <ListRow interactive onClick={onClick} className="home-list-row">
      <div className="home-list-row__main">
        <Text weight="medium" size="3">{task.name}</Text>
        <Text size="1" tone="muted">
          {task.description ? String(task.description) : "No description"}
        </Text>
      </div>
      <div className="home-list-row__meta">
        <Chip color={chipColor}>{chipLabel}</Chip>
        <Text size="1" tone="muted">{elapsedTime(task.updatedAt)}</Text>
      </div>
    </ListRow>
  );
}

function statusToChipColor(
  status: TaskStatus
): "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" {
  if (status === TaskStatus.DONE) {
    return "purple";
  }
  if (status === TaskStatus.IN_PROGRESS) {
    return "green";
  }
  if (status === TaskStatus.NOT_STARTED) {
    return "blue";
  }
  if (status === TaskStatus.FOR_REVIEW) {
    return "orange";
  }
  return "gray";
}
