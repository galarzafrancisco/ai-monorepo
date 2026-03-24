import { Stack, Text, Card, Row, Button } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect } from 'react';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const { setSectionTitle } = useHomeCtx();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();

  // Set document title (browser tab)
  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Settings');
  }, []);

  return (
    <Stack spacing="6">
      {isDesktop ?
        <Text tone="muted">Customize your experience</Text>
        : ''}

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Account</Text>
            <Text tone="muted">Manage your account security</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Update your password</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/account')}
            >
              Change Password
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Appearance</Text>
            <Text tone="muted">Choose your preferred color theme</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Pick a theme for the app</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/appearance')}
            >
              Choose Theme
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Projects</Text>
            <Text tone="muted">Manage your projects</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">View and edit project details</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/projects')}
            >
              Manage Projects
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Chat</Text>
            <Text tone="muted">Configure chat providers for conversations</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Manage OpenAI and other providers</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/chat')}
            >
              Configure Chat
            </Button>
          </Row>
        </Stack>
      </Card>
    </Stack>
  );
}
