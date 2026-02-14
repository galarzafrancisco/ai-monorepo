export type SchedulePreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export type ScheduleConfig = {
  preset: SchedulePreset;
  time: string;
  days: number[];
  dayOfMonth: number;
  cronExpression: string;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const parseTime = (time: string) => {
  const [hourStr = '0', minuteStr = '0'] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
};

const parseNumberList = (value: string, min: number, max: number) => {
  if (!value || value === '*') {
    return [];
  }
  const items = value.split(',');
  const results: number[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = Number(startStr);
      const end = Number(endStr);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      const rangeStart = Math.max(min, Math.min(start, end));
      const rangeEnd = Math.min(max, Math.max(start, end));
      for (let i = rangeStart; i <= rangeEnd; i += 1) {
        results.push(i);
      }
    } else {
      const num = Number(trimmed);
      if (Number.isFinite(num) && num >= min && num <= max) {
        results.push(num);
      }
    }
  }
  return Array.from(new Set(results)).sort((a, b) => a - b);
};

export const buildCronExpression = (config: ScheduleConfig) => {
  if (config.preset === 'custom') {
    return config.cronExpression.trim();
  }
  const { hour, minute } = parseTime(config.time);
  const minStr = pad2(minute);
  const hourStr = pad2(hour);
  if (config.preset === 'daily') {
    return `${minStr} ${hourStr} * * *`;
  }
  if (config.preset === 'weekly') {
    const days = config.days.length ? config.days.join(',') : '1';
    return `${minStr} ${hourStr} * * ${days}`;
  }
  const dayOfMonth = Math.min(Math.max(config.dayOfMonth, 1), 28);
  return `${minStr} ${hourStr} ${dayOfMonth} * *`;
};

export const parseCronExpression = (cronExpression: string): ScheduleConfig => {
  const clean = cronExpression.trim();
  const parts = clean.split(/\s+/);
  if (parts.length < 5) {
    return {
      preset: 'custom',
      time: '09:00',
      days: [],
      dayOfMonth: 1,
      cronExpression: clean,
    };
  }
  const [minute, hour, dom, month, dow] = parts;
  const time = `${pad2(Number(hour))}:${pad2(Number(minute))}`;

  if (dom === '*' && month === '*' && dow === '*') {
    return {
      preset: 'daily',
      time,
      days: [],
      dayOfMonth: 1,
      cronExpression: clean,
    };
  }

  if (dom === '*' && month === '*' && dow !== '*') {
    const days = parseNumberList(dow, 0, 7).map((day) => (day === 7 ? 0 : day));
    if (!days.length) {
      return {
        preset: 'custom',
        time,
        days: [],
        dayOfMonth: 1,
        cronExpression: clean,
      };
    }
    return {
      preset: 'weekly',
      time,
      days,
      dayOfMonth: 1,
      cronExpression: clean,
    };
  }

  if (dom !== '*' && month === '*' && dow === '*') {
    const dayValue = Number(dom);
    return {
      preset: 'monthly',
      time,
      days: [],
      dayOfMonth: Number.isFinite(dayValue) ? dayValue : 1,
      cronExpression: clean,
    };
  }

  return {
    preset: 'custom',
    time: '09:00',
    days: [],
    dayOfMonth: 1,
    cronExpression: clean,
  };
};

export const getNextOccurrences = (config: ScheduleConfig, count = 5) => {
  const now = new Date();
  const { hour, minute } = parseTime(config.time);
  const occurrences: Date[] = [];

  if (config.preset === 'custom') {
    return occurrences;
  }

  if (config.preset === 'daily') {
    const start = new Date(now);
    start.setHours(hour, minute, 0, 0);
    if (start <= now) {
      start.setDate(start.getDate() + 1);
    }
    for (let i = 0; i < count; i += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + i);
      occurrences.push(next);
    }
    return occurrences;
  }

  if (config.preset === 'weekly') {
    const daySet = new Set(config.days.length ? config.days : [1]);
    const maxLookahead = 14 + count * 7;
    for (let offset = 0; offset <= maxLookahead && occurrences.length < count; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);
      const day = candidate.getDay();
      if (daySet.has(day) && candidate > now) {
        occurrences.push(candidate);
      }
    }
    return occurrences;
  }

  const dayOfMonth = Math.min(Math.max(config.dayOfMonth, 1), 28);
  for (let offset = 0; offset < 24 && occurrences.length < count; offset += 1) {
    const candidate = new Date(now);
    candidate.setMonth(now.getMonth() + offset);
    candidate.setDate(dayOfMonth);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate > now) {
      occurrences.push(candidate);
    }
  }
  return occurrences;
};

export const formatScheduleSummary = (config: ScheduleConfig) => {
  if (config.preset === 'custom') {
    return `Cron: ${config.cronExpression}`;
  }
  if (config.preset === 'daily') {
    return `Daily at ${config.time}`;
  }
  if (config.preset === 'weekly') {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = config.days.length ? config.days : [1];
    const dayLabels = days.map((day) => labels[day] ?? '');
    return `Weekly on ${dayLabels.join(', ')} at ${config.time}`;
  }
  return `Monthly on day ${config.dayOfMonth} at ${config.time}`;
};

const SIMPLE_CRON_FIELD_PATTERN = /^[\d*/,\-]+$/;

export const validateCronExpressionInput = (cronExpression: string): string | null => {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Cron must have 5 fields: minute hour day-of-month month day-of-week.';
  }
  if (parts.some((part) => !part || !SIMPLE_CRON_FIELD_PATTERN.test(part))) {
    return 'Cron can only include digits, *, /, -, and commas.';
  }
  return null;
};
