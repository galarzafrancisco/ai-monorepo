import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { TaskDetailView } from '../tasks/TaskDetailPage';
import { TaskStatus } from '../tasks/const';
import type { Task } from '../tasks/types';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import { useToast } from '../../shared/context/ToastContext';
import { useAuth } from '../../auth/AuthContext';
import { useTasksCtx } from '../tasks/TasksProvider';
import { createBlueprintTagEditor, type BlueprintTag } from './blueprintTags';

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
      assigneeActor: blueprint.assigneeActor ?? undefined,
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

  // Latest tags the server accepted. Tag edits chain from here so a run of
  // removals (Clear projects) never rebuilds tagNames from a stale render.
  const latestTags = useRef<BlueprintTag[]>(blueprint?.tags ?? []);
  useEffect(() => {
    latestTags.current = blueprint?.tags ?? [];
  }, [blueprint]);

  const tagEditorFor = (taskId: string) => createBlueprintTagEditor(
    () => latestTags.current,
    (tags) => { latestTags.current = tags; },
    (tagNames) => updateBlueprint(taskId, { tagNames }),
  );

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
      await tagEditorFor(taskId).addTag(tag.name);
    },
    removeTag: async ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      await tagEditorFor(taskId).removeTag(tagId);
    },
    addDependency: async ({ taskId, dependencyTaskId }: { taskId: string; dependencyTaskId: string }) => {
      const current = blueprint?.dependsOnIds ?? [];
      const next = [...current, dependencyTaskId];
      await updateBlueprint(taskId, { dependsOnIds: next });
    },
    removeDependency: async ({ taskId, dependencyTaskId }: { taskId: string; dependencyTaskId: string }) => {
      const current = blueprint?.dependsOnIds ?? [];
      const next = current.filter((id) => id !== dependencyTaskId);
      await updateBlueprint(taskId, { dependsOnIds: next });
    },
  };

  return (
    <TaskDetailView
      task={task}
      backPath="/tasks/schedule"
      setSectionTitle={setSectionTitle}
      handlers={handlers}
      allTasks={tasks}
      canChangeStatus={false}
    />
  );
}
