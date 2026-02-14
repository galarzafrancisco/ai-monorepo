import { useMemo, useState } from 'react';
import { PopShell } from '../../app/shells/PopShell';
import {
  buildCronExpression,
  formatScheduleSummary,
  getNextOccurrences,
  parseCronExpression,
  validateCronExpressionInput,
  type ScheduleConfig,
  type SchedulePreset,
} from './scheduleUtils';
import './ScheduleConfigPop.css';

type ScheduleConfigPopProps = {
  onCancel?: () => void;
  onSave: (payload: { cronExpression: string; enabled: boolean }) => Promise<boolean>;
  initialCronExpression?: string;
  initialEnabled?: boolean;
  title?: string;
  blueprints?: { id: string; name: string }[];
  selectedBlueprintId?: string;
  onSelectBlueprint?: (id: string) => void;
  onRequestNewBlueprint?: () => void;
};

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const defaultConfig: ScheduleConfig = {
  preset: 'daily',
  time: '09:00',
  days: [1],
  dayOfMonth: 1,
  cronExpression: '0 9 * * *',
};

export function ScheduleConfigPop({
  onCancel,
  onSave,
  initialCronExpression,
  initialEnabled = true,
  title = 'Schedule Task',
  blueprints,
  selectedBlueprintId,
  onSelectBlueprint,
  onRequestNewBlueprint,
}: ScheduleConfigPopProps) {
  const initialConfig = initialCronExpression
    ? parseCronExpression(initialCronExpression)
    : defaultConfig;

  const [preset, setPreset] = useState<SchedulePreset>(initialConfig.preset);
  const [time, setTime] = useState(initialConfig.time);
  const [days, setDays] = useState<number[]>(initialConfig.days.length ? initialConfig.days : [1]);
  const [dayOfMonth, setDayOfMonth] = useState(initialConfig.dayOfMonth || 1);
  const [customCron, setCustomCron] = useState(initialConfig.cronExpression || '');
  const [enabled, setEnabled] = useState(initialEnabled);
  const [cronValidationError, setCronValidationError] = useState<string | null>(null);

  const scheduleConfig: ScheduleConfig = useMemo(() => ({
    preset,
    time,
    days,
    dayOfMonth,
    cronExpression: customCron,
  }), [preset, time, days, dayOfMonth, customCron]);

  const cronExpression = useMemo(() => buildCronExpression(scheduleConfig), [scheduleConfig]);
  const preview = useMemo(() => getNextOccurrences({ ...scheduleConfig, cronExpression }), [scheduleConfig, cronExpression]);
  const summary = useMemo(() => formatScheduleSummary({ ...scheduleConfig, cronExpression }), [scheduleConfig, cronExpression]);

  const toggleDay = (day: number) => {
    setDays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((value) => value !== day);
        return next.length ? next : prev;
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleSave = async () => {
    if (preset === 'custom') {
      const validationError = validateCronExpressionInput(cronExpression);
      if (validationError) {
        setCronValidationError(validationError);
        return false;
      }
    }
    setCronValidationError(null);
    return onSave({ cronExpression, enabled });
  };

  return (
    <PopShell title={title} onCancel={onCancel} onSave={handleSave}>
      <div className="schedule-config-pop">
        {blueprints && onSelectBlueprint ? (
          <div className="schedule-config-pop__row">
            <div className="schedule-config-pop__label-row">
              <label className="schedule-config-pop__label">Blueprint</label>
              {onRequestNewBlueprint ? (
                <button
                  type="button"
                  className="schedule-config-pop__link"
                  onClick={onRequestNewBlueprint}
                >
                  + New blueprint
                </button>
              ) : null}
            </div>
            <select
              className="schedule-config-pop__select"
              value={selectedBlueprintId || ''}
              onChange={(event) => onSelectBlueprint(event.target.value)}
            >
              <option value="" disabled>Choose a blueprint</option>
              {blueprints.map((blueprint) => (
                <option key={blueprint.id} value={blueprint.id}>
                  {blueprint.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="schedule-config-pop__row">
          <label className="schedule-config-pop__label">Schedule type</label>
          <select
            className="schedule-config-pop__select"
            value={preset}
            onChange={(event) => setPreset(event.target.value as SchedulePreset)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom cron</option>
          </select>
        </div>

        {preset !== 'custom' ? (
          <div className="schedule-config-pop__row">
            <label className="schedule-config-pop__label">Time</label>
            <input
              className="schedule-config-pop__input"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
        ) : null}

        {preset === 'weekly' ? (
          <div className="schedule-config-pop__row">
            <label className="schedule-config-pop__label">Days</label>
            <div className="schedule-config-pop__days">
              {DAY_LABELS.map((day) => (
                <label key={day.value} className="schedule-config-pop__day">
                  <input
                    type="checkbox"
                    checked={days.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {preset === 'monthly' ? (
          <div className="schedule-config-pop__row">
            <label className="schedule-config-pop__label">Day of month</label>
            <input
              className="schedule-config-pop__input"
              type="number"
              min={1}
              max={28}
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(Number(event.target.value))}
            />
            <div className="schedule-config-pop__helper">Use 1-28 for reliable scheduling.</div>
          </div>
        ) : null}

        {preset === 'custom' ? (
          <div className="schedule-config-pop__row">
            <label className="schedule-config-pop__label">Cron expression</label>
            <input
              className="schedule-config-pop__input"
              placeholder="0 9 * * 1-5"
              value={customCron}
              onChange={(event) => {
                setCustomCron(event.target.value);
                if (cronValidationError) {
                  setCronValidationError(null);
                }
              }}
            />
            <div className="schedule-config-pop__helper">Use 5 fields: minute hour day-of-month month day-of-week.</div>
          </div>
        ) : null}

        {cronValidationError ? (
          <div className="schedule-config-pop__helper">{cronValidationError}</div>
        ) : null}

        <div className="schedule-config-pop__row">
          <label className="schedule-config-pop__label">Enabled</label>
          <label className="schedule-config-pop__toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>{enabled ? 'Active' : 'Paused'}</span>
          </label>
        </div>

        <div className="schedule-config-pop__preview">
          <div className="schedule-config-pop__preview-title">Preview</div>
          <div className="schedule-config-pop__summary">{summary}</div>
          {preset === 'custom' ? (
            <div className="schedule-config-pop__helper">Preview unavailable for custom cron.</div>
          ) : (
            <ul className="schedule-config-pop__list">
              {preview.length === 0 ? (
                <li className="schedule-config-pop__helper">No upcoming occurrences found.</li>
              ) : (
                preview.map((date) => (
                  <li key={date.toISOString()}>{date.toLocaleString()}</li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="schedule-config-pop__helper">Schedules run using the server timezone.</div>

        <div className="schedule-config-pop__cron">Cron: {cronExpression || '—'}</div>
      </div>
    </PopShell>
  );
}
