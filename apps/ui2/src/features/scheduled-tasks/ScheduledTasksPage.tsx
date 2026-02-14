import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Text } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import type { TaskBlueprint, ScheduledTask } from './types';
import { NewBlueprintPop } from './NewBlueprintPop';
import { ScheduleConfigPop } from './ScheduleConfigPop';
import { formatScheduleSummary, parseCronExpression } from './scheduleUtils';
import './ScheduledTasksPage.css';

export function ScheduledTasksPage() {
  const navigate = useNavigate();
  const {
    scheduledTasks,
    isLoading,
    error,
    setSectionTitle,
    createBlueprint,
    createScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    loadScheduledTasks,
  } = useScheduledTasksCtx();
  const { showError } = useToast();

  const [showBlueprintPop, setShowBlueprintPop] = useState(false);
  const [pendingBlueprint, setPendingBlueprint] = useState<TaskBlueprint | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledTask | null>(null);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Scheduled Tasks');
  }, [setSectionTitle]);

  const activeCount = useMemo(
    () => scheduledTasks.filter((task) => task.enabled).length,
    [scheduledTasks],
  );

  const handleBlueprintSave = async (payload: { name: string; description: string; assigneeActorId?: string; tagNames?: string[]; dependsOnIds?: string[]; }) => {
    try {
      const blueprint = await createBlueprint(payload);
      setPendingBlueprint(blueprint);
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  };

  const handleScheduleSave = async (payload: { cronExpression: string; enabled: boolean }) => {
    if (!pendingBlueprint) {
      return false;
    }
    try {
      await createScheduledTask({
        taskBlueprintId: pendingBlueprint.id,
        cronExpression: payload.cronExpression,
        enabled: payload.enabled,
      });
      setPendingBlueprint(null);
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
      <div className="scheduled-tasks-page__header">
        <div>
          <Text size="4" weight="bold">Schedules</Text>
          <Text size="2" tone="muted">{activeCount} active schedules</Text>
        </div>
        <div className="scheduled-tasks-page__header-actions">
          <Button size="sm" variant="ghost" onClick={() => navigate('/tasks')}>
            Back to tasks
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowBlueprintPop(true)}>
            + New schedule
          </Button>
        </div>
      </div>

      {error ? (
        <Text tone="muted">{error}</Text>
      ) : null}

      {isLoading ? (
        <Text tone="muted">Loading scheduled tasks...</Text>
      ) : (
        <div className="scheduled-tasks-page__list">
          {scheduledTasks.length === 0 ? (
            <Card className="scheduled-tasks-page__empty">
              <Text weight="medium">No schedules yet</Text>
              <Text tone="muted">Create a task blueprint and schedule it.</Text>
            </Card>
          ) : (
            scheduledTasks.map((task) => {
              const blueprint = task.taskBlueprint;
              const summary = formatScheduleSummary(parseCronExpression(task.cronExpression));
              return (
                <Card key={task.id} className="scheduled-tasks-page__card">
                  <div className="scheduled-tasks-page__card-main" onClick={() => navigate(`/scheduled-tasks/${task.id}`)}>
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

      {showBlueprintPop ? (
        <NewBlueprintPop
          onCancel={() => setShowBlueprintPop(false)}
          onSave={handleBlueprintSave}
        />
      ) : null}
      {pendingBlueprint ? (
        <ScheduleConfigPop
          title="Schedule Blueprint"
          onCancel={() => setPendingBlueprint(null)}
          onSave={handleScheduleSave}
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
