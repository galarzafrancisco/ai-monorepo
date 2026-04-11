import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataRow, DataRowContainer, Text } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import type { ScheduledTask } from './types';
import { NewTaskPop } from '../tasks/NewTaskPop';
import { formatScheduleSummary, parseCronExpression } from './scheduleUtils';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { TaskRow } from '../tasks/TaskRow';
import { TaskCard } from '../tasks/TaskCard';
import type { Task } from '../tasks/types';
import { TaskStatus } from '../tasks/const';
import { useTasksCtx } from '../tasks/TasksProvider';
import { NewSchedulePop } from './NewSchedulePop';
import './ScheduledTasksPage.css';

export function ScheduledTasksPage() {
  const navigate = useNavigate();
  const {
    scheduledTasks,
    blueprints,
    isLoading,
    error,
    createBlueprint,
    createScheduledTask,
    deleteScheduledTask,
    loadBlueprints,
  } = useScheduledTasksCtx();
  const { setSectionTitle } = useTasksCtx();
  const { showError } = useToast();
  const isDesktop = useIsDesktop();

  const [showBlueprintPop, setShowBlueprintPop] = useState(false);
  const [showSchedulePop, setShowSchedulePop] = useState(false);
  const creatingScheduleRef = useRef(false);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Schedule');
  }, [setSectionTitle]);

  useEffect(() => {
    loadBlueprints().catch(showError);
  }, [loadBlueprints, showError]);

  const activeCount = useMemo(
    () => scheduledTasks.filter((task) => task.enabled).length,
    [scheduledTasks],
  );

  const handleBlueprintSave = async (payload: { title: string; description: string }) => {
    try {
      const blueprint = await createBlueprint({
        name: payload.title,
        description: payload.description,
      });
      setShowBlueprintPop(false);
      navigate(`/tasks/blueprints/${blueprint.id}`);
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  const handleScheduleSave = async (blueprint: { id: string }) => {
    if (creatingScheduleRef.current) {
      return false;
    }
    creatingScheduleRef.current = true;
    try {
      const scheduledTask = await createScheduledTask({
        taskBlueprintId: blueprint.id,
        cronExpression: '0 9 * * *',
        enabled: false,
      });
      setShowSchedulePop(false);
      navigate(`/tasks/schedule/${scheduledTask.id}`);
      return true;
    } catch (err) {
      showError(err);
      return false;
    } finally {
      creatingScheduleRef.current = false;
    }
  };

  const blueprintTasks = useMemo<Task[]>(() => (
    blueprints.map((blueprint) => ({
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
    }))
  ), [blueprints]);

  const handleDelete = async (task: ScheduledTask) => {
    if (!window.confirm('Delete this schedule?')) {
      return;
    }
    try {
      await deleteScheduledTask(task.id);
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className="scheduled-tasks-page">
      {error ? (
        <Text tone="muted">{error}</Text>
      ) : null}

      <section className="scheduled-tasks-page__section">
        {isLoading ? (
          <Text tone="muted">Loading scheduled tasks...</Text>
        ) : (
          <DataRowContainer title="Schedules" action={(
            <div className="scheduled-tasks-page__header-actions">
              <Text size="2" tone="muted">{activeCount} active schedules</Text>
              <Button size="sm" variant="secondary" onClick={() => setShowSchedulePop(true)}>
                + Add schedule
              </Button>
            </div>
          )}>
            {scheduledTasks.length === 0 ? (
              <Card className="scheduled-tasks-page__empty">
                <Text weight="medium">No schedules yet</Text>
                <Text tone="muted">Create a schedule from a blueprint.</Text>
              </Card>
            ) : (
              scheduledTasks.map((task) => {
                const blueprint = task.taskBlueprint;
                const summary = formatScheduleSummary(parseCronExpression(task.cronExpression));
                return (
                  <DataRow
                    key={task.id}
                    onClick={() => navigate(`/tasks/schedule/${task.id}`)}
                    tags={[{ label: task.enabled ? 'enabled' : 'paused', color: task.enabled ? 'green' : 'gray' }]}
                    topRight={<Text size="1" tone="muted">Next: {new Date(task.nextRunAt).toLocaleString()}</Text>}
                    trailing={(
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(task);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  >
                    <Text as="span" weight="medium" size="3">{blueprint?.name || 'Untitled blueprint'}</Text>
                    <Text as="span" size="2" tone="muted">{` ${summary}`}</Text>
                  </DataRow>
                );
              })
            )}
          </DataRowContainer>
        )}
      </section>

      <section className="scheduled-tasks-page__section">
        {blueprintTasks.length === 0 ? (
          <Card className="scheduled-tasks-page__empty">
            <Text weight="medium">No blueprints yet</Text>
            <Text tone="muted">Create a blueprint to reuse task definitions.</Text>
          </Card>
        ) : isDesktop ? (
          <DataRowContainer title="Blueprints" action={(
            <div className="scheduled-tasks-page__header-actions">
              <Text size="2" tone="muted">{blueprints.length} blueprints</Text>
              <Button size="sm" variant="secondary" onClick={() => setShowBlueprintPop(true)}>
                + New blueprint
              </Button>
            </div>
          )}>
            <div className="scheduled-tasks-page__blueprints-board">
              {blueprintTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/tasks/blueprints/${task.id}`)}
                />
              ))}
            </div>
          </DataRowContainer>
        ) : (
          <DataRowContainer title="Blueprints" action={(
            <div className="scheduled-tasks-page__header-actions">
              <Text size="2" tone="muted">{blueprints.length} blueprints</Text>
              <Button size="sm" variant="secondary" onClick={() => setShowBlueprintPop(true)}>
                + New blueprint
              </Button>
            </div>
          )}>
            {blueprintTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={() => navigate(`/tasks/blueprints/${task.id}`)}
              />
            ))}
          </DataRowContainer>
        )}
      </section>

      {showBlueprintPop ? (
        <NewTaskPop
          onCancel={() => setShowBlueprintPop(false)}
          onSave={handleBlueprintSave}
        />
      ) : null}
      {showSchedulePop ? (
        <NewSchedulePop
          blueprints={blueprints}
          onCancel={() => setShowSchedulePop(false)}
          onSave={handleScheduleSave}
          onRequestNewBlueprint={() => {
            setShowSchedulePop(false);
            setShowBlueprintPop(true);
          }}
        />
      ) : null}
    </div>
  );
}
