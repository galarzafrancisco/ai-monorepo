import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { ChatProvidersService } from '@taico/client';
import { ErrorText } from '../../ui/primitives/ErrorText';
import '../../auth/LoginPage.css';
import './SettingsChatPage.css';

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
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerFeedback, setProviderFeedback] = useState<{
    providerId: string;
    action: 'configure' | 'activate' | 'deactivate';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!providerFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setProviderFeedback((current) =>
        current?.providerId === providerFeedback.providerId ? null : current,
      );
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [providerFeedback]);

  useEffect(() => {
    setSectionTitle('Chat Settings');
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const providersData = await ChatProvidersService.chatProvidersControllerListChatProviders();
      setProviders(providersData as ChatProvider[]);
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to load chat settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigureProvider = async (providerId: string) => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setError('');
    setProviderFeedback(null);

    try {
      await ChatProvidersService.chatProvidersControllerUpdateChatProvider(
        providerId,
        {
          apiKey: apiKey,
        }
      );
      setProviderFeedback({
        providerId,
        action: 'configure',
        message: 'Config updated',
      });
      setEditingProviderId(null);
      setApiKey('');
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
    setProviderFeedback(null);

    try {
      await ChatProvidersService.chatProvidersControllerSetActiveChatProvider({
        providerId,
      });
      setProviderFeedback({
        providerId,
        action: 'activate',
        message: 'Now active',
      });
      await loadData();
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to set active provider');
    }
  };

  const handleDeactivate = async (providerId: string) => {
    setError('');
    setProviderFeedback(null);

    try {
      await ChatProvidersService.chatProvidersControllerDeactivateActiveChatProvider();
      setProviderFeedback({
        providerId,
        action: 'deactivate',
        message: 'Deactivated',
      });
      await loadData();
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to deactivate provider');
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

      {providers.length === 0 ? (
        <Card padding="5">
          <Text tone="muted">No chat providers available. OpenAI provider should be created automatically.</Text>
        </Card>
      ) : (
        providers.map((provider) => (
          <Card key={provider.id} padding="5">
            <Stack spacing="4">
              <Row justify="space-between" align="center">
                <Stack spacing="1" className="settings-chat__header-copy">
                  <div className="settings-chat__title-row">
                    <Text size="4" weight="semibold">
                      {provider.name}
                    </Text>
                    {provider.isActive ? (
                      <span className="settings-chat__active-indicator">
                        Active
                      </span>
                    ) : null}
                  </div>
                  {provider.type === 'openai' ? (
                    <Text size="1" tone="muted">
                      You can get an API key from{' '}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-chat__helper-link"
                      >
                        platform.openai.com/api-keys
                      </a>
                    </Text>
                  ) : null}
                </Stack>
              </Row>

              {editingProviderId === provider.id ? (
                <Stack spacing="3">
                  <Stack spacing="2">
                    <Text size="2" weight="medium">
                      Enter API Key
                    </Text>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="login-input"
                      placeholder="sk-..."
                      autoFocus
                    />
                    <Text size="1" tone="muted">
                      Your API key will be stored securely
                    </Text>
                  </Stack>
                  <Row spacing="2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfigureProvider(provider.id)}
                      disabled={!apiKey.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingProviderId(null);
                        setApiKey('');
                      }}
                    >
                      Cancel
                    </Button>
                  </Row>
                </Stack>
              ) : (
                <Row spacing="2">
                  {(() => {
                    const configureFeedback =
                      providerFeedback?.providerId === provider.id
                      && providerFeedback.action === 'configure'
                        ? providerFeedback.message
                        : null;
                    const activateFeedback =
                      providerFeedback?.providerId === provider.id
                      && providerFeedback.action === 'activate'
                        ? providerFeedback.message
                        : null;
                    const deactivateFeedback =
                      providerFeedback?.providerId === provider.id
                      && providerFeedback.action === 'deactivate'
                        ? providerFeedback.message
                        : null;

                    return (
                      <>
                        <Button
                          variant={configureFeedback ? 'primary' : 'secondary'}
                          size="sm"
                        onClick={() => setEditingProviderId(provider.id)}
                      >
                        {configureFeedback || (provider.isConfigured ? 'Update Config' : 'Configure')}
                      </Button>
                      {provider.isActive ? (
                        <Button
                          variant={deactivateFeedback ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleDeactivate(provider.id)}
                        >
                          {deactivateFeedback || 'Deactivate'}
                        </Button>
                      ) : (
                        <span title={!provider.isConfigured ? 'Configure the provider first to set it as active' : ''}>
                          <Button
                            variant={activateFeedback ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => handleSetActive(provider.id)}
                            disabled={!provider.isConfigured}
                          >
                            {activateFeedback || 'Set Active'}
                          </Button>
                        </span>
                      )}
                      </>
                    );
                  })()}
                </Row>
              )}
            </Stack>
          </Card>
        ))
      )}

    </Stack>
  );
}
