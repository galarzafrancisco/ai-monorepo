import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stack } from '../../ui/primitives/Stack';
import { Text } from '../../ui/primitives/Text';
import { useHomeCtx } from '../home/HomeProvider';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useAuth } from '../../auth/AuthContext';
import { useWalkthrough, type WalkthroughStep } from './useWalkthrough';
import { WalkthroughService } from './api';
import './WalkthroughPage.css';

function StepRow({
  step,
  isCompleted,
  isCurrent,
  isLast,
  isExpanded,
  onToggle,
}: {
  step: WalkthroughStep;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="walkthrough-step">
      {/* Rail */}
      <div className="walkthrough-step-rail">
        <div
          className={[
            'walkthrough-step-dot',
            isCompleted ? 'walkthrough-step-dot--completed' : '',
            isCurrent ? 'walkthrough-step-dot--current' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isCompleted && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        {!isLast && (
          <div
            className={[
              'walkthrough-step-connector',
              isCompleted ? 'walkthrough-step-connector--completed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        )}
      </div>

      {/* Body */}
      <div className="walkthrough-step-body">
        <button
          className="walkthrough-step-header"
          onClick={onToggle}
          aria-expanded={isExpanded}
        >
          <Text
            size="2"
            weight={isCurrent ? 'semibold' : 'medium'}
            className={isCompleted ? 'walkthrough-label-done' : ''}
          >
            {step.label}
          </Text>
        </button>

        {isExpanded && (
          <div className="walkthrough-step-detail">
            <Text size="2" tone="muted" as="p" className="walkthrough-step-description">
              {step.description}
            </Text>
            <Link to={step.href} className="walkthrough-step-cta">
              Go →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function WalkthroughPage() {
  const { setSectionTitle } = useHomeCtx();
  const { user, refreshAuth } = useAuth();
  const { status, isLoading } = useWalkthrough();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const reactivatedRef = useRef(false);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Setup walkthrough');
  }, [setSectionTitle]);

  // If user dismissed the walkthrough (OFF) but hasn't finished, re-enable the banner
  // so it shows up again on /home the next time they visit.
  useEffect(() => {
    if (reactivatedRef.current || !user || !status) return;
    if (user.onboardingDisplayMode === 'OFF' && status.completedCount < status.totalCount) {
      reactivatedRef.current = true;
      WalkthroughService.WalkthroughController_acknowledge()
        .then(() => refreshAuth())
        .catch(console.error);
    }
  }, [user, status, refreshAuth]);

  // Auto-expand the first incomplete step once data loads
  useEffect(() => {
    if (!status || initializedRef.current) return;
    initializedRef.current = true;
    const firstIncomplete = status.steps.find((s) => !s.completed);
    if (firstIncomplete) {
      setExpandedIds(new Set([firstIncomplete.id]));
    }
  }, [status]);

  const toggleStep = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completedCount = status?.completedCount ?? 0;
  const totalCount = status?.totalCount ?? 8;
  const firstIncompleteIndex = status?.steps.findIndex((s) => !s.completed) ?? -1;

  return (
    <div className="walkthrough-page">
      <Stack spacing="5" className="walkthrough-page-inner">
        <Stack spacing="1">
          <Text size="2" tone="muted" as="p">
            Complete these steps to get the most out of Taico.
          </Text>
          <Text size="2" weight="semibold">
            {completedCount} / {totalCount} completed
          </Text>
        </Stack>

        {isLoading ? (
          <Text size="2" tone="muted">Loading...</Text>
        ) : (
          <div className="walkthrough-track">
            {status?.steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                isCompleted={step.completed}
                isCurrent={index === firstIncompleteIndex}
                isLast={index === (status.steps.length - 1)}
                isExpanded={expandedIds.has(step.id)}
                onToggle={() => toggleStep(step.id)}
              />
            ))}
          </div>
        )}
      </Stack>
    </div>
  );
}
