import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LoginShell } from './LoginShell';
import { Stack } from '../ui/primitives/Stack';
import { Text } from '../ui/primitives/Text';
import { Button } from '../ui/primitives/Button';
import { Card } from '../ui/primitives/Card';
import { Row } from '../ui/primitives/Row';
import { WebAuthenticationService } from './api';
import { useAuth } from './AuthContext';
import './WalkthroughPage.css';

interface Primitive {
  title: string;
  description: string;
  icon: string;
}

const PRIMITIVES: Primitive[] = [
  {
    title: 'Tasks',
    description: 'Units of work with assignees (human or agent). Track status changes and progress.',
    icon: '✓',
  },
  {
    title: 'Agents',
    description: 'AI assistants that work on tasks. Each agent has its own configuration and capabilities.',
    icon: '🤖',
  },
  {
    title: 'Threads',
    description: 'Coordination when tasks branch into parallel work. Auto-created on subtask creation.',
    icon: '💬',
  },
  {
    title: 'Context',
    description: 'Addressable text blocks that can be attached to tasks, threads, and projects.',
    icon: '📝',
  },
];

export function WalkthroughPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await WebAuthenticationService.webAuthControllerMarkWalkthroughSeen();
      // Refresh auth state to update onboarding display mode
      await refreshAuth();
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Failed to mark walkthrough as seen:', err);
      setError('Failed to save progress. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <LoginShell>
      <Stack spacing="5" className="walkthrough-content">
        <Stack spacing="2" align="center" className="walkthrough-header">
          <Text size="6" weight="bold" as="div">
            Welcome to Taico
          </Text>
          <Text size="3" tone="muted" as="p">
            Taico models execution with four core primitives
          </Text>
        </Stack>

        <Stack spacing="3">
          {PRIMITIVES.map((primitive) => (
            <Card key={primitive.title} className="primitive-card">
              <Row spacing="3" align="start">
                <div className="primitive-icon">{primitive.icon}</div>
                <Stack spacing="1" className="primitive-content">
                  <Text size="4" weight="semibold">
                    {primitive.title}
                  </Text>
                  <Text size="2" tone="muted">
                    {primitive.description}
                  </Text>
                </Stack>
              </Row>
            </Card>
          ))}
        </Stack>

        {error && (
          <Text size="2" tone="muted" className="walkthrough-error">
            {error}
          </Text>
        )}

        <Button
          onClick={handleComplete}
          variant="primary"
          disabled={isLoading}
          className="walkthrough-button"
        >
          {isLoading ? 'Getting Started...' : 'Get Started'}
        </Button>
      </Stack>
    </LoginShell>
  );
}
