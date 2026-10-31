import type {
  ExecutionStep,
  ExecutionStepEvent,
  ExecutionRepositoryProgress,
} from '@taico/events';
import type { TraceEvent } from './traceEntries';

const definitions: Array<{
  id: ExecutionStep;
  label: string;
  description: string;
  /** Only shown when the worker reports it for this run. */
  optional?: boolean;
}> = [
  {
    id: 'workspace',
    label: 'Prepare workspace',
    description: 'Prepare the working directory and repositories.',
  },
  {
    id: 'setup',
    label: 'Set up agent',
    description: 'Load the task context, tools and agent configuration.',
  },
  {
    id: 'agent',
    label: 'Run agent',
    description: 'The agent works on the task.',
  },
  {
    id: 'follow_up',
    label: 'Final checks',
    description: 'The agent reviews its work before the run ends.',
    optional: true,
  },
  {
    id: 'finish',
    label: 'Finish execution',
    description: 'Save the result and release worker resources.',
  },
];
export type ExecutionProgressStep = (typeof definitions)[number] & {
  status: ExecutionStepEvent['status'] | 'pending' | 'not_run' | 'stale';
  message?: string;
  repositories: Array<
    Omit<ExecutionRepositoryProgress, 'status'> & {
      status: ExecutionRepositoryProgress['status'] | 'stopped';
    }
  >;
};

/** Use recorded facts; old workers and missing events must not invent success. */
export function buildExecutionSteps(
  events: TraceEvent[],
  terminal: boolean,
  stale: boolean,
): ExecutionProgressStep[] {
  if (
    !events.some(
      (event) =>
        event.source === 'worker' &&
        event.payload &&
        typeof event.payload === 'object' &&
        'type' in event.payload &&
        event.payload.type === 'taico.execution.step',
    )
  )
    return [];
  const allRecords = events
    .filter((event) => event.source === 'worker')
    .map((event) => event.payload as unknown as ExecutionStepEvent)
    .filter((record) => record?.type === 'taico.execution.step');
  const reported = definitions.filter(
    (definition) =>
      !definition.optional ||
      allRecords.some((record) => record.step === definition.id),
  );
  return reported.map((definition) => {
    const records = allRecords.filter(
      (record) => record.step === definition.id,
    );
    const latest = records.at(-1);
    const repositories = new Map<string, ExecutionRepositoryProgress>();
    for (const record of records)
      if (record.repository)
        repositories.set(record.repository.slug, record.repository);
    let status: ExecutionProgressStep['status'] = latest?.status ?? 'pending';
    if (status === 'pending' && terminal) status = 'not_run';
    if (status === 'running' && terminal) status = stale ? 'stale' : 'not_run';
    return {
      ...definition,
      status,
      message: latest?.message,
      repositories: [...repositories.values()].map((repo) => ({
        ...repo,
        status: terminal && repo.status === 'running' ? 'stopped' : repo.status,
      })),
    };
  });
}
