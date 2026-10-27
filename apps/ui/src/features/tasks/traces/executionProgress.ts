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
        event.harness === 'worker' &&
        event.payload &&
        typeof event.payload === 'object' &&
        'type' in event.payload &&
        event.payload.type === 'taico.execution.step',
    )
  )
    return [];
  return definitions.map((definition) => {
    const records = events
      .filter((event) => event.harness === 'worker')
      .map((event) => event.payload as unknown as ExecutionStepEvent)
      .filter(
        (record) =>
          record?.type === 'taico.execution.step' &&
          record.step === definition.id,
      );
    const latest = records.at(-1);
    const repositories = new Map<string, ExecutionRepositoryProgress>();
    for (const record of records)
      if (record.repository)
        repositories.set(record.repository.slug, record.repository);
    let status: ExecutionProgressStep['status'] =
      latest?.status ?? (terminal ? 'not_run' : 'pending');
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
