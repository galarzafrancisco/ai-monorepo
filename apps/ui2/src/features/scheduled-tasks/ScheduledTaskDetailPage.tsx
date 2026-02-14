import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, DataRow, DataRowContainer, Text } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import {
  buildCronExpression,
  formatScheduleSummary,
  parseCronExpression,
  type SchedulePreset,
} from './scheduleUtils';
import type { TaskBlueprint } from './types';
import { useTasksCtx } from '../tasks/TasksProvider';
import './ScheduledTaskDetailPage.css';

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

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

  const [preset, setPreset] = useState<SchedulePreset>('daily');
  const [time, setTime] = useState('09:00');
  const [days, setDays] = useState<number[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customCron, setCustomCron] = useState('0 9 * * *');
  const [enabled, setEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const scheduledTask = scheduledTasks.find((item) => item.id === scheduleId);
  const blueprint: TaskBlueprint | undefined = scheduledTask?.taskBlueprint || (scheduledTask ? blueprintsById[scheduledTask.taskBlueprintId] : undefined);

  useDocumentTitle();

  useEffect(() => {
    if (!scheduleId) {
      return;
    }
    if (!scheduledTask) {
      loadScheduledTask(scheduleId).catch(showError);
    }
  }, [scheduleId, scheduledTask, loadScheduledTask, showError]);

  useEffect(() => {
    if (scheduledTask && !scheduledTask.taskBlueprint) {
      loadBlueprint(scheduledTask.taskBlueprintId).catch(showError);
    }
  }, [scheduledTask, loadBlueprint, showError]);

  useEffect(() => {
    if (blueprint?.name) {
      setSectionTitle(blueprint.name);
    } else {
      setSectionTitle('Schedule');
    }
  }, [blueprint, setSectionTitle]);

  useEffect(() => {
    if (!scheduledTask) {
      return;
    }
    const parsed = parseCronExpression(scheduledTask.cronExpression);
    setPreset(parsed.preset);
    setTime(parsed.time);
    setDays(parsed.days.length ? parsed.days : [1]);
    setDayOfMonth(parsed.dayOfMonth || 1);
    setCustomCron(parsed.cronExpression || scheduledTask.cronExpression);
    setEnabled(scheduledTask.enabled);
  }, [scheduledTask]);

  const cronExpression = useMemo(() => buildCronExpression({
    preset,
    time,
    days,
    dayOfMonth,
    cronExpression: customCron,
  }), [preset, time, days, dayOfMonth, customCron]);

  if (!scheduledTask) {
    return (
      <div className="scheduled-task-detail-page">
        <Text tone="muted">Scheduled task not found.</Text>
        <Button variant="secondary" onClick={() => navigate('/tasks/schedule')}>Back to schedules</Button>
      </div>
    );
  }

  const summary = formatScheduleSummary({
    preset,
    time,
    days,
    dayOfMonth,
    cronExpression,
  });

  const toggleDay = (day: number) => {
    setDays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((value) => value !== day);
        return next.length ? next : prev;
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const saveSchedule = async () => {
    setIsSaving(true);
    try {
      await updateScheduledTask(scheduledTask.id, {
        cronExpression,
        enabled,
      });
    } catch (err) {
      showError(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="scheduled-task-detail-page">
      <DataRowContainer title="Task" className="scheduled-task-detail-page__section">
        <DataRow
          onClick={() => navigate(`/tasks/blueprints/${scheduledTask.taskBlueprintId}`)}
          tags={[{ label: 'blueprint', color: 'blue' }]}
          trailing={<Text size="2" tone="muted">Open</Text>}
        >
          <Text as="span" weight="medium" size="3">{blueprint?.name || 'Untitled blueprint'}</Text>
          <Text as="span" tone="muted" size="2">{` ${blueprint?.description || 'No description'}`}</Text>
        </DataRow>
      </DataRowContainer>

      <DataRowContainer title="Schedule" className="scheduled-task-detail-page__section">
        <div className="scheduled-task-detail-page__controls">
          <label className="scheduled-task-detail-page__label">
            <Text size="2" tone="muted">Frequency</Text>
            <select
              className="scheduled-task-detail-page__select"
              value={preset}
              onChange={(event) => setPreset(event.target.value as SchedulePreset)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom (cron)</option>
            </select>
          </label>

          {preset !== 'custom' ? (
            <label className="scheduled-task-detail-page__label">
              <Text size="2" tone="muted">Time</Text>
              <input
                className="scheduled-task-detail-page__input"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          ) : null}

          {preset === 'weekly' ? (
            <div className="scheduled-task-detail-page__label">
              <Text size="2" tone="muted">Days</Text>
              <div className="scheduled-task-detail-page__day-grid">
                {DAY_LABELS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={`scheduled-task-detail-page__day ${days.includes(day.value) ? 'is-selected' : ''}`}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {preset === 'monthly' ? (
            <label className="scheduled-task-detail-page__label">
              <Text size="2" tone="muted">Date</Text>
              <input
                className="scheduled-task-detail-page__input"
                type="date"
                value={`2026-01-${String(Math.min(Math.max(dayOfMonth, 1), 28)).padStart(2, '0')}`}
                onChange={(event) => {
                  const day = new Date(`${event.target.value}T00:00:00`).getDate();
                  if (Number.isFinite(day)) {
                    setDayOfMonth(Math.min(Math.max(day, 1), 28));
                  }
                }}
              />
            </label>
          ) : null}

          {preset === 'custom' ? (
            <label className="scheduled-task-detail-page__label">
              <Text size="2" tone="muted">Cron expression</Text>
              <input
                className="scheduled-task-detail-page__input"
                value={customCron}
                onChange={(event) => setCustomCron(event.target.value)}
                placeholder="0 9 * * 1-5"
              />
            </label>
          ) : null}

          <div className="scheduled-task-detail-page__toggle-row">
            <Text size="2" tone="muted">Status</Text>
            <div className="scheduled-task-detail-page__toggle-buttons">
              <Button
                size="sm"
                variant={enabled ? 'primary' : 'secondary'}
                onClick={() => setEnabled(true)}
              >
                On
              </Button>
              <Button
                size="sm"
                variant={!enabled ? 'primary' : 'secondary'}
                onClick={() => setEnabled(false)}
              >
                Off
              </Button>
            </div>
          </div>
        </div>

        <DataRow topRight={<Text size="1" tone="muted">Next: {new Date(scheduledTask.nextRunAt).toLocaleString()}</Text>}>
          <Text as="span" size="2">{summary}</Text>
        </DataRow>
        <DataRow>
          <Text as="span" size="2" style="mono">{cronExpression}</Text>
        </DataRow>
      </DataRowContainer>

      <DataRowContainer className="scheduled-task-detail-page__actions">
        <Button size="lg" variant="primary" onClick={saveSchedule} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save schedule'}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => navigate('/tasks/schedule')}>
          Back to schedules
        </Button>
      </DataRowContainer>
    </div>
  );
}
