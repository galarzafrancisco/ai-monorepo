import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Text, Stack } from "../../ui/primitives";
import { TasksService } from "../tasks/api";
import type { Task } from "../tasks/types";
import { TaskCard } from "../tasks/TaskCard";
import "./TasksAppPreview.css";

const PREVIEW_LIMIT = 6;

export function TasksAppPreview(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const loadTasks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await TasksService.tasksControllerListTasks(
          undefined,
          undefined,
          undefined,
          1,
          PREVIEW_LIMIT
        );
        if (isMounted) {
          setTasks(response.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load tasks preview");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTasks();
    return () => {
      isMounted = false;
    };
  }, []);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="tasks-app-preview__empty">
        <Text size="2" tone="muted">Loading tasks preview...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tasks-app-preview__empty">
        <Text size="2" tone="muted">{error}</Text>
      </div>
    );
  }

  if (sortedTasks.length === 0) {
    return (
      <div className="tasks-app-preview__empty">
        <Text size="2" tone="muted">No tasks available yet.</Text>
      </div>
    );
  }

  return (
    <Stack spacing="3" className="tasks-app-preview">
      <div className="tasks-app-preview__grid">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => navigate(`/tasks/task/${task.id}`)}
          />
        ))}
      </div>
      <Text size="1" tone="muted">
        Showing the latest {Math.min(sortedTasks.length, PREVIEW_LIMIT)} tasks.
      </Text>
    </Stack>
  );
}
