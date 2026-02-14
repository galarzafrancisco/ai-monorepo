import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataRowContainer, Text } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import type { ScheduledTask } from './types';
import { NewTaskPop } from '../tasks/NewTaskPop';
import { ScheduleConfigPop } from './ScheduleConfigPop';
import { formatScheduleSummary, parseCronExpression } from './scheduleUtils';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { TaskRow } from '../tasks/TaskRow';
import { TaskCard } from '../tasks/TaskCard';
import type { Task } from '../tasks/types';
import { TaskStatus } from '../tasks/const';
import { useTasksCtx } from '../tasks/TasksProvider';
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
    updateScheduledTask,
    deleteScheduledTask,
    loadScheduledTasks,
    loadBlueprints,
  } = useScheduledTasksCtx();
  const { setSectionTitle } = useTasksCtx();
  const { showError } = useToast();
  const isDesktop = useIsDesktop();

  const [showBlueprintPop, setShowBlueprintPop] = useState(false);
  const [showSchedulePop, setShowSchedulePop] = useState(false);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<ScheduledTask | null>(null);

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
      setSelectedBlueprintId(blueprint.id);
      navigate(`/tasks/blueprints/${blueprint.id}`);
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  const handleScheduleSave = async (payload: { cronExpression: string; enabled: boolean }) => {
    if (!selectedBlueprintId) {
      showError('Choose a blueprint before scheduling.');
      return false;
    }
    try {
      await createScheduledTask({
        taskBlueprintId: selectedBlueprintId,
        cronExpression: payload.cronExpression,
        enabled: payload.enabled,
      });
      setShowSchedulePop(false);
      setSelectedBlueprintId('');
      await loadScheduledTasks();
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  const handleUpdateSchedule = async (payload: { cronExpression: string; enabled: boolean }) => {
    if (!editingSchedule) {
      return false;
    }
    try {
      await updateScheduledTask(editingSchedule.id, payload);
      setEditingSchedule(null);
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  const blueprintTasks = useMemo<Task[]>(() => (
    blueprints.map((blueprint) => ({
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
        <div className="scheduled-tasks-page__header">
          <div>
            <Text size="4" weight="bold">Schedules</Text>
            <Text size="2" tone="muted">{activeCount} active schedules</Text>
          </div>
          <div className="scheduled-tasks-page__header-actions">
            <Button size="sm" variant="secondary" onClick={() => setShowSchedulePop(true)}>
              + Add schedule
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Text tone="muted">Loading scheduled tasks...</Text>
        ) : (
          <div className="scheduled-tasks-page__list">
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
                  <Card key={task.id} className="scheduled-tasks-page__card">
                    <div className="scheduled-tasks-page__card-main" onClick={() => navigate(`/tasks/schedule/${task.id}`)}>
                      <div>
                        <Text weight="medium" size="3">{blueprint?.name || 'Untitled blueprint'}</Text>
                        <Text size="2" tone="muted">{summary}</Text>
                      </div>
                      <div className="scheduled-tasks-page__meta">
                        <Text size="2">Next: {new Date(task.nextRunAt).toLocaleString()}</Text>
                        <span className={`scheduled-tasks-page__status ${task.enabled ? 'is-enabled' : 'is-disabled'}`}>
                          {task.enabled ? 'Enabled' : 'Paused'}
                        </span>
                      </div>
                    </div>
                    <div className="scheduled-tasks-page__actions">
                      <Button size="sm" variant="ghost" onClick={() => setEditingSchedule(task)}>
                        Edit schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          updateScheduledTask(task.id, { enabled: !task.enabled }).catch(showError);
                        }}
                      >
                        {task.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(task)}>
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </section>

      <section className="scheduled-tasks-page__section">
        <div className="scheduled-tasks-page__header">
          <div>
            <Text size="4" weight="bold">Blueprints</Text>
            <Text size="2" tone="muted">{blueprints.length} blueprints</Text>
          </div>
          <div className="scheduled-tasks-page__header-actions">
            <Button size="sm" variant="secondary" onClick={() => setShowBlueprintPop(true)}>
              + New blueprint
            </Button>
          </div>
        </div>

        {blueprintTasks.length === 0 ? (
          <Card className="scheduled-tasks-page__empty">
            <Text weight="medium">No blueprints yet</Text>
            <Text tone="muted">Create a blueprint to reuse task definitions.</Text>
          </Card>
        ) : isDesktop ? (
          <div className="scheduled-tasks-page__blueprints-board">
            {blueprintTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate(`/tasks/blueprints/${task.id}`)}
              />
            ))}
          </div>
        ) : (
          <DataRowContainer>
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
        <ScheduleConfigPop
          title="Create Schedule"
          onCancel={() => setShowSchedulePop(false)}
          onSave={handleScheduleSave}
          blueprints={blueprints.map((blueprint) => ({ id: blueprint.id, name: blueprint.name }))}
          selectedBlueprintId={selectedBlueprintId}
          onSelectBlueprint={setSelectedBlueprintId}
          onRequestNewBlueprint={() => {
            setShowSchedulePop(false);
            setShowBlueprintPop(true);
          }}
        />
      ) : null}
      {editingSchedule ? (
        <ScheduleConfigPop
          title="Edit Schedule"
          initialCronExpression={editingSchedule.cronExpression}
          initialEnabled={editingSchedule.enabled}
          onCancel={() => setEditingSchedule(null)}
          onSave={handleUpdateSchedule}
        />
      ) : null}
    </div>
  );
}
