import {
  Check,
  ChevronRight,
  LoaderCircle,
  Minus,
  OctagonPause,
  X,
} from 'lucide-react';
import { Text } from '../../../ui/primitives';
import { buildExecutionSteps } from './executionProgress';
import type { TraceEvent } from './traceEntries';
import './ExecutionSteps.css';

const labels = {
  pending: 'Waiting',
  running: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
  interrupted: 'Interrupted',
  cancelled: 'Cancelled',
  not_run: 'Not recorded',
  stale: 'Stopped reporting',
};

export function ExecutionSteps({
  events,
  terminal,
  stale,
  loading,
}: {
  events: TraceEvent[];
  terminal: boolean;
  stale: boolean;
  loading: boolean;
}) {
  const steps = buildExecutionSteps(events, terminal, stale);
  if (!steps.length)
    return loading ? null : (
      <p className="execution-steps__unavailable">
        Step details unavailable for this run.
      </p>
    );
  const completed = steps.filter((step) => step.status === 'completed').length;
  return (
    <details className="execution-steps" open>
      <summary>
        <ChevronRight size={14} />
        <Text size="2" weight="medium">
          Execution progress
        </Text>
        <span>
          {completed} / {steps.length}
        </span>
      </summary>
      <ol className="execution-steps__track" aria-label="Execution steps">
        {steps.map((step) => {
          const Icon =
            step.status === 'completed'
              ? Check
              : step.status === 'running'
                ? LoaderCircle
                : step.status === 'failed'
                  ? X
                  : step.status === 'interrupted' || step.status === 'cancelled'
                    ? OctagonPause
                    : Minus;
          return (
            <li
              key={step.id}
              className={`execution-steps__step execution-steps__step--${step.status}`}
              aria-current={step.status === 'running' ? 'step' : undefined}
            >
              <div className="execution-steps__rail" aria-hidden="true">
                <span className="execution-steps__dot">
                  {step.status !== 'pending' && <Icon size={12} />}
                </span>
                <span className="execution-steps__connector" />
              </div>
              <div className="execution-steps__body">
                <div className="execution-steps__heading">
                  <Text size="2" weight="medium">
                    {step.label}
                  </Text>
                  <span className="execution-steps__status">
                    {labels[step.status]}
                  </span>
                </div>
                <Text size="1" tone="muted">
                  {step.message || step.description}
                </Text>
                {!!step.repositories.length && (
                  <ul
                    className="execution-steps__repos"
                    aria-label="Repositories"
                  >
                    {step.repositories.map((repo) => (
                      <li key={repo.slug}>
                        <span
                          className={`execution-steps__repo-icon execution-steps__repo-icon--${repo.status}`}
                          aria-hidden="true"
                        >
                          {repo.status === 'completed' ? (
                            <Check size={12} />
                          ) : repo.status === 'failed' ? (
                            <X size={12} />
                          ) : repo.status === 'stopped' ? (
                            <Minus size={12} />
                          ) : (
                            <LoaderCircle size={12} />
                          )}
                        </span>
                        <span>
                          <strong>{repo.slug}</strong>
                          <span className="execution-steps__repo-name">
                            {repo.repository}
                          </span>
                        </span>
                        <span className="execution-steps__repo-state">
                          {repo.status === 'failed'
                            ? 'Failed'
                            : repo.status === 'stopped'
                              ? 'Stopped'
                              : repo.action === 'clone'
                                ? repo.status === 'completed'
                                  ? 'Cloned'
                                  : 'Cloning…'
                                : repo.status === 'completed'
                                  ? 'Fetched'
                                  : 'Fetching…'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
