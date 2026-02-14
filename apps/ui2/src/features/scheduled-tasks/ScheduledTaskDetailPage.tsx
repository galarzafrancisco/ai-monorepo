import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Text } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import { ScheduleConfigPop } from './ScheduleConfigPop';
import { formatScheduleSummary, getNextOccurrences, parseCronExpression } from './scheduleUtils';
import type { TaskBlueprint } from './types';
import { useTasksCtx } from '../tasks/TasksProvider';
import './ScheduledTaskDetailPage.css';

export function ScheduledTaskDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const {
    scheduledTasks,
    blueprintsById,
    loadScheduledTask,
    loadBlueprint,
    updateScheduledTask,
  } = useScheduledTasksCtx();
  const { setSectionTitle } = useTasksCtx();
  const { showError } = useToast();

  const [localScheduledTaskId, setLocalScheduledTaskId] = useState(scheduleId ?? '');
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);

  const scheduledTask = scheduledTasks.find((item) => item.id === localScheduledTaskId);
  const blueprint: TaskBlueprint | undefined = scheduledTask?.taskBlueprint || (scheduledTask ? blueprintsById[scheduledTask.taskBlueprintId] : undefined);

  useDocumentTitle();

  useEffect(() => {
    if (scheduleId) {
      setLocalScheduledTaskId(scheduleId);
    }
  }, [scheduleId]);

  useEffect(() => {
    if (!localScheduledTaskId) {
      return;
    }
    if (!scheduledTask) {
      loadScheduledTask(localScheduledTaskId).catch(showError);
    }
  }, [localScheduledTaskId, scheduledTask, loadScheduledTask, showError]);

  useEffect(() => {
    if (scheduledTask && !scheduledTask.taskBlueprint) {
      loadBlueprint(scheduledTask.taskBlueprintId).catch(showError);
    }
  }, [scheduledTask, loadBlueprint, showError]);

  useEffect(() => {
    if (blueprint?.name) {
      setSectionTitle(blueprint.name);
    } else {
      setSectionTitle('Scheduled Task');
    }
  }, [blueprint, setSectionTitle]);

  const scheduleConfig = useMemo(() => {
    if (!scheduledTask) {
      return null;
    }
    return parseCronExpression(scheduledTask.cronExpression);
  }, [scheduledTask]);

  const preview = useMemo(() => {
    if (!scheduleConfig || !scheduledTask) {
      return [];
    }
    return getNextOccurrences({ ...scheduleConfig, cronExpression: scheduledTask.cronExpression });
  }, [scheduleConfig, scheduledTask]);

    if (!scheduledTask) {
      return (
        <div className="scheduled-task-detail-page">
          <Text tone="muted">Scheduled task not found.</Text>
          <Button variant="secondary" onClick={() => navigate('/tasks/schedule')}>Back to schedules</Button>
        </div>
      );
    }

  const summary = scheduleConfig
    ? formatScheduleSummary({ ...scheduleConfig, cronExpression: scheduledTask.cronExpression })
    : scheduledTask.cronExpression;

  return (
    <div className="scheduled-task-detail-page">
      <Card className="scheduled-task-detail-page__card">
        <div className="scheduled-task-detail-page__section">
          <div>
            <Text weight="bold" size="3">Blueprint</Text>
            <Text tone="muted" size="2">Task definition used for each run.</Text>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (scheduledTask.taskBlueprintId) {
                navigate(`/tasks/blueprints/${scheduledTask.taskBlueprintId}`);
              }
            }}
          >
            Open blueprint
          </Button>
        </div>
        <div className="scheduled-task-detail-page__blueprint">
          <Text size="3" weight="medium">{blueprint?.name || 'Untitled blueprint'}</Text>
          <Text tone="muted">{blueprint?.description || 'No description provided.'}</Text>
          <div className="scheduled-task-detail-page__meta">
            <div>
              <Text size="2" weight="medium">Assignee</Text>
              <Text size="2" tone="muted">
                {blueprint?.assigneeActor ? `${blueprint.assigneeActor.displayName} (@${blueprint.assigneeActor.slug})` : 'Unassigned'}
              </Text>
            </div>
            <div>
              <Text size="2" weight="medium">Tags</Text>
              <div className="scheduled-task-detail-page__tags">
                {blueprint?.tags?.length ? (
                  blueprint.tags.map((tag) => (
                    <span key={tag.id} className="scheduled-task-detail-page__tag" style={{ backgroundColor: tag.color || 'var(--border)' }}>
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <Text size="2" tone="muted">No tags</Text>
                )}
              </div>
            </div>
            <div>
              <Text size="2" weight="medium">Dependencies</Text>
              <Text size="2" tone="muted">
                {blueprint?.dependsOnIds?.length ? blueprint.dependsOnIds.join(', ') : 'None'}
              </Text>
            </div>
          </div>
        </div>
      </Card>

      <Card className="scheduled-task-detail-page__card">
        <div className="scheduled-task-detail-page__section">
          <div>
            <Text weight="bold" size="3">Schedule</Text>
            <Text tone="muted" size="2">When tasks are created.</Text>
          </div>
          <div className="scheduled-task-detail-page__actions">
            <Button size="sm" variant="ghost" onClick={() => setShowScheduleEdit(true)}>
              Edit schedule
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                updateScheduledTask(scheduledTask.id, { enabled: !scheduledTask.enabled }).catch(showError);
              }}
            >
              {scheduledTask.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
        <div className="scheduled-task-detail-page__schedule">
          <Text size="2">{summary}</Text>
          <Text size="2" tone="muted">Next run: {new Date(scheduledTask.nextRunAt).toLocaleString()}</Text>
          <Text size="2" tone="muted">Cron: {scheduledTask.cronExpression}</Text>
          <div className="scheduled-task-detail-page__preview">
            <Text size="2" weight="medium">Next 5 occurrences</Text>
            {scheduleConfig?.preset === 'custom' ? (
              <Text size="2" tone="muted">Preview unavailable for custom cron.</Text>
            ) : (
              <ul>
                {preview.map((date) => (
                  <li key={date.toISOString()}>{date.toLocaleString()}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card className="scheduled-task-detail-page__card">
        <div className="scheduled-task-detail-page__section">
          <Text weight="bold" size="3">History</Text>
          <Text tone="muted" size="2">Task run history will appear here.</Text>
        </div>
        <Text size="2" tone="muted">No run history yet.</Text>
      </Card>

      <Button variant="secondary" onClick={() => navigate('/tasks/schedule')}>
        Back to schedules
      </Button>

      {showScheduleEdit ? (
        <ScheduleConfigPop
          title="Edit Schedule"
          initialCronExpression={scheduledTask.cronExpression}
          initialEnabled={scheduledTask.enabled}
          onCancel={() => setShowScheduleEdit(false)}
          onSave={async (payload) => {
            try {
              await updateScheduledTask(scheduledTask.id, payload);
              setShowScheduleEdit(false);
              return true;
            } catch (err) {
              showError(err);
              return false;
            }
          }}
        />
      ) : null}
    </div>
  );
}
