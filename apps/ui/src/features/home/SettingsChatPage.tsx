import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { ChatProvidersService } from '@taico/client';
import { ErrorText } from '../../ui/primitives/ErrorText';
import '../../auth/LoginPage.css';
import './SettingsPage.css';
import './SettingsChatPage.css';

type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'google_vertex'
  | 'openai_compatible'
  | 'adk';

interface ChatProvider {
  id: string;
  name: string;
  type: ProviderType;
  secretId: string | null;
  modelId: string | null;
  baseUrl: string | null;
  project: string | null;
  location: string | null;
  isActive: boolean;
  isConfigured: boolean;
}

type ProviderForm = {
  apiKey: string;
  modelId: string;
  baseUrl: string;
  project: string;
  location: string;
};

type ProviderTypeInfo = {
  label: string;
  help: string;
  defaultModel: string | null;
  /** Label of the secret field, or null when the provider stores no secret. */
  secretLabel: string | null;
  secretPlaceholder: string;
  secretRequired: boolean;
  multilineSecret?: boolean;
  hasBaseUrl?: boolean;
  hasVertexSettings?: boolean;
};

const PROVIDER_TYPES: Record<ProviderType, ProviderTypeInfo> = {
  openai: {
    label: 'OpenAI',
    help: 'Get an API key from platform.openai.com/api-keys.',
    defaultModel: 'gpt-5.4',
    secretLabel: 'API key',
    secretPlaceholder: 'sk-...',
    secretRequired: true,
  },
  anthropic: {
    label: 'Anthropic',
    help: 'Get an API key from console.anthropic.com.',
    defaultModel: 'claude-opus-5-5',
    secretLabel: 'API key',
    secretPlaceholder: 'sk-ant-...',
    secretRequired: true,
  },
  google: {
    label: 'Google Gemini API',
    help: 'Get an API key from aistudio.google.com.',
    defaultModel: 'gemini-3.6-flash',
    secretLabel: 'API key',
    secretPlaceholder: 'AIza...',
    secretRequired: true,
  },
  google_vertex: {
    label: 'Google Vertex AI',
    help: 'Anything left empty falls back to the server environment (application default credentials, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION).',
    defaultModel: 'gemini-3.6-flash',
    secretLabel: 'Service account JSON (optional)',
    secretPlaceholder: '{ "type": "service_account", ... }',
    secretRequired: false,
    multilineSecret: true,
    hasVertexSettings: true,
  },
  openai_compatible: {
    label: 'OpenAI-compatible',
    help: 'Any server that speaks the OpenAI chat API, such as Ollama or OpenRouter. Needs a base URL and a model.',
    defaultModel: null,
    secretLabel: 'API key (optional)',
    secretPlaceholder: 'sk-...',
    secretRequired: false,
    hasBaseUrl: true,
  },
  adk: {
    label: 'Google (environment)',
    help: 'Uses Google AI environment variables on the server (GOOGLE_API_KEY or Vertex AI config). No key stored here.',
    defaultModel: 'gemini-3.6-flash',
    secretLabel: null,
    secretPlaceholder: '',
    secretRequired: false,
  },
};

const CREATABLE_TYPES: ProviderType[] = [
  'openai',
  'anthropic',
  'google',
  'google_vertex',
  'openai_compatible',
];

const EMPTY_FORM: ProviderForm = {
  apiKey: '',
  modelId: '',
  baseUrl: '',
  project: '',
  location: '',
};

export function SettingsChatPage() {
  const { setSectionTitle } = useHomeCtx();
  const [providers, setProviders] = useState<ChatProvider[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderType, setNewProviderType] = useState<ProviderType>('anthropic');
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

  const startEditing = (provider: ChatProvider) => {
    setError('');
    setEditingProviderId(provider.id);
    setForm({
      apiKey: '',
      modelId: provider.modelId ?? '',
      baseUrl: provider.baseUrl ?? '',
      project: provider.project ?? '',
      location: provider.location ?? '',
    });
  };

  const stopEditing = () => {
    setEditingProviderId(null);
    setForm(EMPTY_FORM);
  };

  const handleAddProvider = async () => {
    const name = newProviderName.trim() || PROVIDER_TYPES[newProviderType].label;

    setError('');
    try {
      const created = await ChatProvidersService.chatProvidersControllerCreateChatProvider({
        name,
        type: newProviderType as never,
      });
      setNewProviderName('');
      await loadData();
      startEditing(created as ChatProvider);
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to add provider');
    }
  };

  const handleConfigureProvider = async (provider: ChatProvider) => {
    const info = PROVIDER_TYPES[provider.type];

    if (info.secretRequired && !provider.secretId && !form.apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    if (info.hasBaseUrl && (!form.baseUrl.trim() || !form.modelId.trim())) {
      setError('Please enter a base URL and a model');
      return;
    }

    setError('');
    setProviderFeedback(null);

    try {
      await ChatProvidersService.chatProvidersControllerUpdateChatProvider(
        provider.id,
        {
          // An empty secret field keeps the stored one.
          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
          modelId: form.modelId,
          ...(info.hasBaseUrl ? { baseUrl: form.baseUrl } : {}),
          ...(info.hasVertexSettings
            ? { project: form.project, location: form.location }
            : {}),
        }
      );
      setProviderFeedback({
        providerId: provider.id,
        action: 'configure',
        message: 'Config updated',
      });
      stopEditing();
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
      <Stack spacing="6" className="settings-subpage">
        <Text>Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        Configure chat providers for thread conversations. The active provider and its model power every thread.
      </Text>

      {error && (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      )}

      {providers.length === 0 ? (
        <Card padding="5" className="settings-panel-card">
          <Text tone="muted">No chat providers available. OpenAI provider should be created automatically.</Text>
        </Card>
      ) : (
        providers.map((provider) => (
          <Card key={provider.id} padding="5" className="settings-panel-card">
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
                  <Text size="1" tone="muted">
                    {PROVIDER_TYPES[provider.type].label} · Model:{' '}
                    {provider.modelId
                      || (PROVIDER_TYPES[provider.type].defaultModel
                        ? `${PROVIDER_TYPES[provider.type].defaultModel} (default)`
                        : 'not set')}
                  </Text>
                  <Text size="1" tone="muted">
                    {PROVIDER_TYPES[provider.type].help}
                  </Text>
                </Stack>
              </Row>

              {editingProviderId === provider.id ? (
                <Stack spacing="3">
                  {(() => {
                    const info = PROVIDER_TYPES[provider.type];
                    const field = (
                      label: string,
                      key: keyof ProviderForm,
                      placeholder: string,
                    ) => (
                      <Stack spacing="2">
                        <Text size="2" weight="medium">
                          {label}
                        </Text>
                        <input
                          type="text"
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          className="login-input"
                          placeholder={placeholder}
                        />
                      </Stack>
                    );

                    return (
                      <>
                        {info.secretLabel ? (
                          <Stack spacing="2">
                            <Text size="2" weight="medium">
                              {info.secretLabel}
                            </Text>
                            {info.multilineSecret ? (
                              <textarea
                                value={form.apiKey}
                                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                                className="login-input settings-chat__secret-textarea"
                                placeholder={info.secretPlaceholder}
                                rows={4}
                              />
                            ) : (
                              <input
                                type="password"
                                value={form.apiKey}
                                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                                className="login-input"
                                placeholder={info.secretPlaceholder}
                                autoFocus
                              />
                            )}
                            <Text size="1" tone="muted">
                              {provider.secretId
                                ? 'A value is already stored. Leave empty to keep it.'
                                : 'Stored securely on the server.'}
                            </Text>
                          </Stack>
                        ) : null}
                        {info.hasBaseUrl
                          ? field('Base URL', 'baseUrl', 'http://localhost:11434/v1')
                          : null}
                        {field(
                          'Model',
                          'modelId',
                          info.defaultModel ? `${info.defaultModel} (default)` : 'model name',
                        )}
                        {info.hasVertexSettings ? (
                          <>
                            {field('Project ID', 'project', 'From GOOGLE_CLOUD_PROJECT')}
                            {field('Location', 'location', 'From GOOGLE_CLOUD_LOCATION')}
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                  <Row spacing="2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfigureProvider(provider)}
                    >
                      Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={stopEditing}>
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
                    const actionFeedback = activateFeedback || deactivateFeedback;
                    const isActionDisabled = !provider.isActive && !provider.isConfigured;
                    const actionVariant = actionFeedback
                      ? 'primary'
                      : provider.isActive
                        ? 'danger'
                        : 'primary';
                    const actionLabel = actionFeedback
                      || (provider.isActive ? 'Deactivate' : 'Set Active');
                    const actionHandler = provider.isActive
                      ? () => handleDeactivate(provider.id)
                      : () => handleSetActive(provider.id);
                    const actionTitle = isActionDisabled
                      ? 'Configure the provider first to set it as active'
                      : '';

                    return (
                      <>
                        <Button
                          variant={configureFeedback ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => startEditing(provider)}
                        >
                          {configureFeedback || (provider.isConfigured ? 'Update Config' : 'Configure')}
                        </Button>
                        <span className="settings-chat__action-wrapper" title={actionTitle}>
                          <Button
                            variant={actionVariant}
                            size="sm"
                            onClick={actionHandler}
                            disabled={isActionDisabled}
                            className="settings-chat__action-button"
                            data-feedback={activateFeedback ? 'active' : deactivateFeedback ? 'deactivated' : null}
                          >
                            {actionLabel}
                          </Button>
                        </span>
                        </>
                    );
                  })()}
                </Row>
              )}
            </Stack>
          </Card>
        ))
      )}

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="3">
          <Text size="4" weight="semibold">
            Add a provider
          </Text>
          <Row spacing="2" align="center" className="settings-chat__add-row">
            <select
              value={newProviderType}
              onChange={(e) => setNewProviderType(e.target.value as ProviderType)}
              className="login-input settings-chat__add-field"
              aria-label="Provider type"
            >
              {CREATABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROVIDER_TYPES[type].label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              className="login-input settings-chat__add-field"
              placeholder={`Name (default: ${PROVIDER_TYPES[newProviderType].label})`}
              aria-label="Provider name"
            />
            <Button variant="primary" size="sm" onClick={handleAddProvider}>
              Add
            </Button>
          </Row>
        </Stack>
      </Card>

    </Stack>
  );
}
