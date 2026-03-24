import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { ChatProvidersService, SecretsService } from '@taico/client';
import { ErrorText } from '../../ui/primitives/ErrorText';
import '../../auth/LoginPage.css';

interface ChatProvider {
  id: string;
  name: string;
  type: string;
  secretId: string | null;
  isActive: boolean;
  isConfigured: boolean;
}

export function SettingsChatPage() {
  const { setSectionTitle } = useHomeCtx();
  const [providers, setProviders] = useState<ChatProvider[]>([]);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSecretId, setSelectedSecretId] = useState<string>('');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  useEffect(() => {
    setSectionTitle('Chat Settings');
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [providersData, secretsData] = await Promise.all([
        ChatProvidersService.chatProvidersControllerListChatProviders(),
        SecretsService.secretsControllerListSecrets(),
      ]);
      setProviders(providersData as ChatProvider[]);
      setSecrets(secretsData);
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to load chat settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigureProvider = async (providerId: string) => {
    if (!selectedSecretId) {
      setError('Please select an API key');
      return;
    }

    setError('');
    setSuccess('');

    try {
      await ChatProvidersService.chatProvidersControllerUpdateChatProvider(
        providerId,
        {
          secretId: selectedSecretId,
        }
      );
      setSuccess('Provider configured successfully');
      setEditingProviderId(null);
      setSelectedSecretId('');
      await loadData();
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to configure provider');
    }
  };

  const handleSetActive = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider?.isConfigured) {
      setError('Please configure the provider first');
      return;
    }

    setError('');
    setSuccess('');

    try {
      await ChatProvidersService.chatProvidersControllerSetActiveChatProvider({
        providerId,
      });
      setSuccess('Active provider set successfully');
      await loadData();
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to set active provider');
    }
  };

  if (isLoading) {
    return (
      <Stack spacing="6">
        <Text>Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack spacing="6">
      <Text tone="muted">Configure chat providers for thread conversations</Text>

      {error && (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      )}

      {success && (
        <div style={{ color: 'var(--accent)' }}>
          <Text size="2" weight="medium">
            {success}
          </Text>
        </div>
      )}

      {providers.length === 0 ? (
        <Card padding="5">
          <Text tone="muted">No chat providers available. OpenAI provider should be created automatically.</Text>
        </Card>
      ) : (
        providers.map((provider) => (
          <Card key={provider.id} padding="5">
            <Stack spacing="4">
              <Row justify="space-between" align="center">
                <Stack spacing="1">
                  <Text size="4" weight="semibold">
                    {provider.name}
                  </Text>
                  <Text size="2" tone="muted">
                    Type: {provider.type}
                  </Text>
                </Stack>
                {provider.isConfigured && (
                  <div style={{ color: 'var(--accent)' }}>
                    <Text size="2" weight="medium">
                      ✓ Configured
                    </Text>
                  </div>
                )}
              </Row>

              {editingProviderId === provider.id ? (
                <Stack spacing="3">
                  <Stack spacing="2">
                    <Text size="2" weight="medium">
                      Select API Key
                    </Text>
                    <select
                      value={selectedSecretId}
                      onChange={(e) => setSelectedSecretId(e.target.value)}
                      className="login-input"
                    >
                      <option value="">-- Select a secret --</option>
                      {secrets.map((secret) => (
                        <option key={secret.id} value={secret.id}>
                          {secret.name}
                        </option>
                      ))}
                    </select>
                  </Stack>
                  <Row spacing="2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfigureProvider(provider.id)}
                      disabled={!selectedSecretId}
                    >
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingProviderId(null);
                        setSelectedSecretId('');
                      }}
                    >
                      Cancel
                    </Button>
                  </Row>
                </Stack>
              ) : (
                <Row spacing="2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingProviderId(provider.id)}
                  >
                    Configure
                  </Button>
                  {provider.isConfigured && (
                    <Button
                      variant={provider.isActive ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleSetActive(provider.id)}
                      disabled={provider.isActive}
                    >
                      {provider.isActive ? 'Active' : 'Set Active'}
                    </Button>
                  )}
                </Row>
              )}
            </Stack>
          </Card>
        ))
      )}

      <Card padding="5">
        <Stack spacing="3">
          <Text size="3" weight="semibold">
            Need an API Key?
          </Text>
          <Text tone="muted">
            Create secrets for your API keys in the Secrets page, then come back here to configure your chat provider.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
