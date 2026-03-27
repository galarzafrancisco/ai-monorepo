import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { TaskDetailView } from '../tasks/TaskDetailPage';
import { TaskStatus } from '../tasks/const';
import type { Task } from '../tasks/types';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import { useToast } from '../../shared/context/ToastContext';
import { useAuth } from '../../auth/AuthContext';
import { useTasksCtx } from '../tasks/TasksProvider';

export function TaskBlueprintDetailPage() {
  const { taskBlueprintId } = useParams<{ taskBlueprintId: string }>();
  const { user } = useAuth();
  const { showError } = useToast();
  const {
    blueprints,
    blueprintsById,
    loadBlueprint,
    updateBlueprint,
    deleteBlueprint,
  } = useScheduledTasksCtx();
  const { setSectionTitle, tasks } = useTasksCtx();

  const blueprint = useMemo(() => {
    if (!taskBlueprintId) {
      return undefined;
    }
    return blueprintsById[taskBlueprintId] || blueprints.find((item) => item.id === taskBlueprintId);
  }, [blueprints, blueprintsById, taskBlueprintId]);

  useEffect(() => {
    if (!taskBlueprintId || blueprint) {
      return;
    }
    loadBlueprint(taskBlueprintId).catch(showError);
  }, [taskBlueprintId, blueprint, loadBlueprint, showError]);

  const task = useMemo<Task | undefined>(() => {
    if (!blueprint) {
      return undefined;
    }
    return {
      id: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      status: TaskStatus.NOT_STARTED,
      assignee: null,
      assigneeActor: blueprint.assigneeActor ?? null,
      sessionId: null,
      comments: [],
      artefacts: [],
      inputRequests: [],
      tags: blueprint.tags,
      createdByActor: blueprint.createdByActor,
      dependsOnIds: blueprint.dependsOnIds,
      createdAt: blueprint.createdAt,
      updatedAt: blueprint.updatedAt,
    };
  }, [blueprint]);

  const handlers = {
    addComment: async () => {
      throw new Error('Blueprints do not support comments.');
    },
    deleteTask: async ({ taskId }: { taskId: string }) => {
      await deleteBlueprint(taskId);
    },
    assignTask: async ({ taskId, assigneeActorId }: { taskId: string; assigneeActorId: string }) => {
      await updateBlueprint(taskId, {
        assigneeActorId: assigneeActorId as unknown as Record<string, any>,
      });
    },
    assignTaskToMe: async ({ taskId }: { taskId: string }) => {
      if (!user?.actorId) {
        throw new Error('No user session found.');
      }
      await updateBlueprint(taskId, {
        assigneeActorId: user.actorId as unknown as Record<string, any>,
      });
    },
    answerInputRequest: async () => {
      throw new Error('Blueprints do not support input requests.');
    },
    changeStatus: async () => {
      throw new Error('Blueprints do not have status updates.');
    },
    addTag: async ({ taskId, tag }: { taskId: string; tag: { name: string } }) => {
      const current = blueprint?.tags?.map((item) => item.name) ?? [];
      const next = current.includes(tag.name) ? current : [...current, tag.name];
      await updateBlueprint(taskId, { tagNames: next });
    },
    removeTag: async ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      const current = blueprint?.tags ?? [];
      const next = current.filter((item) => item.id !== tagId).map((item) => item.name);
      await updateBlueprint(taskId, { tagNames: next });
    },
  };

  return (
    <TaskDetailView
      task={task}
      backPath="/tasks/schedule"
      setSectionTitle={setSectionTitle}
      handlers={handlers}
      allTasks={tasks}
    />
  );
}
