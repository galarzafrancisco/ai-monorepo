import { Stack, Text, Card, Row, Button } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette } from '../../ui/components';
import { MetaService } from '@taico/client';

export function SettingsPage() {
  const { setSectionTitle } = useHomeCtx();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { registerCommands } = useCommandPalette();
  const [version, setVersion] = useState<{ backend: string; ui: string } | null>(null);

  // Set document title (browser tab)
  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Settings');
    loadVersion();
  }, []);

  const loadVersion = async () => {
    try {
      const versionData = await MetaService.metaControllerGetVersion();
      setVersion(versionData);
    } catch (error) {
      console.error('Failed to load version:', error);
    }
  };

  // Register page-specific commands
  useEffect(() => {
    const commands = [
      {
        id: 'settings-account',
        label: 'Account Settings',
        description: 'Manage your account security',
        aliases: ['password', 'account', 'security'],
        onSelect: () => navigate('/settings/account'),
      },
      {
        id: 'settings-appearance',
        label: 'Appearance Settings',
        description: 'Choose your preferred color theme',
        aliases: ['theme', 'appearance', 'dark mode', 'light mode'],
        onSelect: () => navigate('/settings/appearance'),
      },
      {
        id: 'settings-projects',
        label: 'Projects Settings',
        description: 'Manage your projects',
        aliases: ['projects', 'manage projects'],
        onSelect: () => navigate('/settings/projects'),
      },
      {
        id: 'settings-chat',
        label: 'Chat Settings',
        description: 'Configure chat providers for conversations',
        aliases: ['chat', 'openai', 'providers', 'chat providers'],
        onSelect: () => navigate('/settings/chat'),
      },
      {
        id: 'settings-workers',
        label: 'Workers Settings',
        description: 'Configure and manage background workers',
        aliases: ['workers', 'background', 'execution'],
        onSelect: () => navigate('/settings/workers'),
      },
      {
        id: 'settings-ai-providers',
        label: 'AI Providers',
        description: 'View usage and quota for AI providers',
        aliases: ['ai', 'providers', 'usage', 'quota', 'anthropic', 'openai', 'claude'],
        onSelect: () => navigate('/settings/ai-providers'),
      },
      {
        id: 'settings-data',
        label: 'Import / Export',
        description: 'Import and export workspace data',
        aliases: ['data', 'export', 'import', 'backup', 'restore'],
        onSelect: () => navigate('/settings/data'),
      },
    ];

    return registerCommands(commands);
  }, [registerCommands, navigate]);

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

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Workers</Text>
            <Text tone="muted">Configure and manage background workers</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Set up workers for task execution</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/workers')}
            >
              Manage Workers
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">AI Providers</Text>
            <Text tone="muted">View usage and quota for AI providers</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Monitor Anthropic and OpenAI usage</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/ai-providers')}
            >
              Settings
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Import / Export</Text>
            <Text tone="muted">Back up and restore workspace data</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Export blocks and import archive files</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings/data')}
            >
              Manage Data
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="3">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Setup walkthrough</Text>
            <Text tone="muted">Step-by-step guide to configuring Taico</Text>
          </Stack>
          <Row justify="space-between" align="center">
            <Text size="2" tone="muted">Review setup steps and track your progress</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/walkthrough')}
            >
              Open walkthrough
            </Button>
          </Row>
        </Stack>
      </Card>

      {version && (
        <div style={{
          textAlign: 'center',
          paddingTop: 'var(--space-6)',
          marginTop: 'var(--space-4)',
          borderTop: '1px solid var(--border)',
        }}>
          <Text size="1" tone="muted">
            Taico v{version.backend} • UI v{version.ui}
          </Text>
        </div>
      )}
    </Stack>
  );
}
