import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect } from 'react';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import './SettingsPage.css';
import './SettingsAIProvidersPage.css';

export function SettingsAIProvidersPage() {
  const { setSectionTitle } = useHomeCtx();

  // Set document title (browser tab)
  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('AI Providers');
  }, []);

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        View usage and quota information for AI providers.
      </Text>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Row justify="space-between" align="center">
            <Stack spacing="1">
              <Text size="4" weight="semibold">OpenAI</Text>
              <Text size="1" tone="muted">
                Codex and GPT models
              </Text>
            </Stack>
          </Row>

          <Stack spacing="2">
            <Row spacing="2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open('https://chatgpt.com/codex/cloud/settings/usage', '_blank', 'noopener,noreferrer')}
              >
                See usage
              </Button>
            </Row>
          </Stack>
        </Stack>
      </Card>


      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Row justify="space-between" align="center">
            <Stack spacing="1">
              <Text size="4" weight="semibold">Anthropic</Text>
              <Text size="1" tone="muted">
                Claude models
              </Text>
            </Stack>
          </Row>

          <Stack spacing="2">
            <Row spacing="2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open('https://claude.ai/settings/usage', '_blank', 'noopener,noreferrer')}
              >
                See usage
              </Button>
            </Row>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
