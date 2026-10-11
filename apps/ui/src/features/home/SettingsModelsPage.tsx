import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AiModelSelectionsService,
  AiProvidersService,
  type AiModelSelectionResponseDto,
  type AiProviderModelResponseDto,
  type AiProviderResponseDto,
} from '@taico/client';
import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useHomeCtx } from './HomeProvider';
import '../../auth/LoginPage.css';
import './SettingsPage.css';
import './SettingsModelsPage.css';

type ProviderType = `${AiProviderResponseDto.type}`;
type Job = `${AiModelSelectionResponseDto.job}`;
type ModelKind = `${AiProviderModelResponseDto.kind}`;

type JobInfo = {
  job: Job;
  label: string;
  help: string;
  kind: ModelKind;
  /** Uses the conversation model when it has no selection of its own. */
  followsConversation: boolean;
};

const JOBS: JobInfo[] = [
  {
    job: 'conversation',
    label: 'Conversation',
    help: 'The model that answers in threads. Pick your most capable model.',
    kind: 'language',
    followsConversation: false,
  },
  {
    job: 'quick_tasks',
    label: 'Quick tasks',
    help: 'Small background jobs like naming threads and enriching context. Pick something fast and cheap, such as Claude Haiku or GPT Luna.',
    kind: 'language',
    followsConversation: true,
  },
  {
    job: 'middle_manager',
    label: 'Middle manager',
    help: "Keeps each thread's shared notes up to date as its tasks change.",
    kind: 'language',
    followsConversation: true,
  },
  {
    job: 'embeddings',
    label: 'Search embeddings',
    help: 'Turns content into vectors for search. Search does not use it yet. Changing it later means re-indexing everything, so pick one and keep it.',
    kind: 'embedding',
    followsConversation: false,
  },
];

type ProviderTypeInfo = {
  label: string;
  help: string;
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
    secretLabel: 'API key',
    secretPlaceholder: 'sk-...',
    secretRequired: true,
  },
  anthropic: {
    label: 'Anthropic',
    help: 'Get an API key from console.anthropic.com.',
    secretLabel: 'API key',
    secretPlaceholder: 'sk-ant-...',
    secretRequired: true,
  },
  google: {
    label: 'Google Gemini API',
    help: 'Get an API key from aistudio.google.com.',
    secretLabel: 'API key',
    secretPlaceholder: 'AIza...',
    secretRequired: true,
  },
  google_vertex: {
    label: 'Google Vertex AI',
    help: 'Anything left empty falls back to the server environment (application default credentials, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION).',
    secretLabel: 'Service account JSON (optional)',
    secretPlaceholder: '{ "type": "service_account", ... }',
    secretRequired: false,
    multilineSecret: true,
    hasVertexSettings: true,
  },
  openai_compatible: {
    label: 'OpenAI-compatible',
    help: 'Any server that speaks the OpenAI chat API, such as Ollama, LiteLLM or OpenRouter. Needs a base URL.',
    secretLabel: 'API key (optional)',
    secretPlaceholder: 'sk-...',
    secretRequired: false,
    hasBaseUrl: true,
  },
};

const CREATABLE_TYPES = Object.keys(PROVIDER_TYPES) as ProviderType[];

const ADD_PROVIDER_OPTION = '__add_provider__';
const CUSTOM_MODEL_OPTION = '__custom_model__';

type ProviderModels =
  | { status: 'loading' }
  | { status: 'ready'; models: AiProviderModelResponseDto[] }
  | { status: 'error'; message: string };

type ProviderForm = {
  name: string;
  apiKey: string;
  baseUrl: string;
  project: string;
  location: string;
};

const errorDetail = (err: unknown, fallback: string): string =>
  (err as { body?: { detail?: string } })?.body?.detail || fallback;

export function SettingsModelsPage() {
  const { setSectionTitle } = useHomeCtx();
  const [providers, setProviders] = useState<AiProviderResponseDto[]>([]);
  const [selections, setSelections] = useState<AiModelSelectionResponseDto[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, ProviderModels>>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderType, setNewProviderType] = useState<ProviderType>('anthropic');
  const addProviderRef = useRef<HTMLSelectElement>(null);
  const requestedModels = useRef(new Set<string>());

  useDocumentTitle();

  const loadData = useCallback(async () => {
    try {
      const [providersData, selectionsData] = await Promise.all([
        AiProvidersService.aiProvidersControllerListAiProviders(),
        AiModelSelectionsService.aiModelSelectionsControllerListAiModelSelections(),
      ]);
      setProviders(providersData);
      setSelections(selectionsData);
    } catch (err) {
      setError(errorDetail(err, 'Failed to load model settings'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSectionTitle('AI models');
    void loadData();
  }, [loadData, setSectionTitle]);

  const loadModels = useCallback(async (providerId: string, force = false) => {
    if (!force && requestedModels.current.has(providerId)) {
      return;
    }
    requestedModels.current.add(providerId);
    setModelsByProvider((current) => ({ ...current, [providerId]: { status: 'loading' } }));
    try {
      const models = await AiProvidersService.aiProvidersControllerListAiProviderModels(providerId);
      setModelsByProvider((current) => ({ ...current, [providerId]: { status: 'ready', models } }));
    } catch (err) {
      setModelsByProvider((current) => ({
        ...current,
        [providerId]: {
          status: 'error',
          message: errorDetail(err, 'Could not list models from the provider.'),
        },
      }));
    }
  }, []);

  const focusAddProvider = () => {
    addProviderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    addProviderRef.current?.focus();
  };

  const handleSaveSelection = async (job: Job, aiProviderId: string, modelId: string) => {
    setError('');
    try {
      if (aiProviderId) {
        await AiModelSelectionsService.aiModelSelectionsControllerSetAiModelSelection(job, {
          aiProviderId,
          modelId,
        });
      } else {
        await AiModelSelectionsService.aiModelSelectionsControllerClearAiModelSelection(job);
      }
      await loadData();
      return true;
    } catch (err) {
      setError(errorDetail(err, 'Failed to save the model'));
      return false;
    }
  };

  const handleAddProvider = async () => {
    const name = newProviderName.trim() || PROVIDER_TYPES[newProviderType].label;

    setError('');
    try {
      const created = await AiProvidersService.aiProvidersControllerCreateAiProvider({
        name,
        type: newProviderType as never,
      });
      setNewProviderName('');
      await loadData();
      setEditingProviderId(created.id);
    } catch (err) {
      setError(errorDetail(err, 'Failed to add provider'));
    }
  };

  const handleSaveProvider = async (provider: AiProviderResponseDto, form: ProviderForm) => {
    const info = PROVIDER_TYPES[provider.type];

    if (!form.name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (info.secretRequired && !provider.secretId && !form.apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    if (info.hasBaseUrl && !form.baseUrl.trim()) {
      setError('Please enter a base URL');
      return;
    }

    setError('');
    try {
      await AiProvidersService.aiProvidersControllerUpdateAiProvider(provider.id, {
        name: form.name.trim(),
        // An empty secret field keeps the stored one.
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
        ...(info.hasBaseUrl ? { baseUrl: form.baseUrl } : {}),
        ...(info.hasVertexSettings ? { project: form.project, location: form.location } : {}),
      });
      setEditingProviderId(null);
      await loadData();
      // New credentials or endpoint can change which models the provider offers.
      await loadModels(provider.id, true);
    } catch (err) {
      setError(errorDetail(err, 'Failed to save provider'));
    }
  };

  const handleDeleteProvider = async (provider: AiProviderResponseDto) => {
    setError('');
    try {
      await AiProvidersService.aiProvidersControllerDeleteAiProvider(provider.id);
      await loadData();
    } catch (err) {
      setError(errorDetail(err, 'Failed to delete provider'));
    }
  };

  if (isLoading) {
    return (
      <Stack spacing="6" className="settings-subpage">
        <Text>Loading...</Text>
      </Stack>
    );
  }

  const jobsByProvider = (providerId: string): string[] =>
    JOBS.filter((info) =>
      selections.some((s) => s.job === info.job && s.aiProviderId === providerId),
    ).map((info) => info.label);

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        Providers are the AI services Taico can call. Models are picked per job, so each job can
        use a different model from a different provider.
      </Text>

      {error && (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      )}

      <Stack spacing="3">
        <Text size="4" weight="semibold">
          Models
        </Text>
        <Card padding="5" className="settings-panel-card">
          <div className="settings-models__jobs">
            {JOBS.map((info) => {
              const selection = selections.find((s) => s.job === info.job);
              return selection ? (
                <JobRow
                  key={info.job}
                  info={info}
                  selection={selection}
                  providers={providers}
                  modelsByProvider={modelsByProvider}
                  onLoadModels={loadModels}
                  onSave={(providerId, modelId) =>
                    handleSaveSelection(info.job, providerId, modelId)
                  }
                  onAddProvider={focusAddProvider}
                />
              ) : null;
            })}
          </div>
        </Card>
      </Stack>

      <Stack spacing="3">
        <Text size="4" weight="semibold">
          Providers
        </Text>

        {providers.length === 0 ? (
          <Card padding="5" className="settings-panel-card">
            <Text tone="muted">No providers yet. Add one below to pick models from it.</Text>
          </Card>
        ) : (
          providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              usedBy={jobsByProvider(provider.id)}
              models={modelsByProvider[provider.id]}
              isEditing={editingProviderId === provider.id}
              onEdit={() => {
                setError('');
                setEditingProviderId(provider.id);
              }}
              onCancel={() => setEditingProviderId(null)}
              onSave={(form) => handleSaveProvider(provider, form)}
              onDelete={() => handleDeleteProvider(provider)}
              onTest={() => loadModels(provider.id, true)}
            />
          ))
        )}

        <Card padding="5" className="settings-panel-card">
          <Stack spacing="3">
            <Text size="3" weight="semibold">
              Add a provider
            </Text>
            <Row spacing="2" align="center" className="settings-models__add-row">
              <select
                ref={addProviderRef}
                value={newProviderType}
                onChange={(e) => setNewProviderType(e.target.value as ProviderType)}
                className="login-input settings-models__add-field"
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
                className="login-input settings-models__add-field"
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
    </Stack>
  );
}

function JobRow({
  info,
  selection,
  providers,
  modelsByProvider,
  onLoadModels,
  onSave,
  onAddProvider,
}: {
  info: JobInfo;
  selection: AiModelSelectionResponseDto;
  providers: AiProviderResponseDto[];
  modelsByProvider: Record<string, ProviderModels>;
  onLoadModels: (providerId: string) => void;
  onSave: (providerId: string, modelId: string) => Promise<boolean>;
  onAddProvider: () => void;
}) {
  const savedProviderId = selection.aiProviderId ?? '';
  const savedModelId = selection.modelId ?? '';
  const [providerId, setProviderId] = useState(savedProviderId);
  const [modelId, setModelId] = useState(savedModelId);
  const [isTypingModel, setIsTypingModel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setProviderId(savedProviderId);
    setModelId(savedModelId);
    setIsTypingModel(false);
  }, [savedProviderId, savedModelId]);

  const provider = providers.find((p) => p.id === providerId);
  const canListModels = !!provider?.isConfigured;

  useEffect(() => {
    if (providerId && canListModels) {
      onLoadModels(providerId);
    }
  }, [providerId, canListModels, onLoadModels]);

  useEffect(() => {
    if (!justSaved) {
      return;
    }
    const timeoutId = window.setTimeout(() => setJustSaved(false), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [justSaved]);

  const listing = providerId ? modelsByProvider[providerId] : undefined;
  const offered = listing?.status === 'ready' ? listing.models : [];
  const ofKind = offered.filter((model) => model.kind === info.kind);
  // A provider that does not label its models still lets the user pick from everything.
  const options = (ofKind.length > 0 ? ofKind : offered).map((model) => model.id);
  if (modelId && !isTypingModel && !options.includes(modelId)) {
    options.unshift(modelId);
  }
  const showTextInput = isTypingModel || listing?.status === 'error' || !canListModels;

  const isDirty = providerId !== savedProviderId || modelId.trim() !== savedModelId;
  const canSave = isDirty && !isSaving && (providerId === '' || modelId.trim() !== '');

  const handleProviderChange = (value: string) => {
    if (value === ADD_PROVIDER_OPTION) {
      onAddProvider();
      return;
    }
    setProviderId(value);
    setModelId(value === savedProviderId ? savedModelId : '');
    setIsTypingModel(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const saved = await onSave(providerId, modelId.trim());
    setIsSaving(false);
    setJustSaved(saved);
  };

  const emptyLabel = info.followsConversation ? 'Same as Conversation' : 'Not selected';

  let status: { text: string; tone: 'ready' | 'pending' };
  if (selection.isReady) {
    status = {
      text: selection.followsConversation
        ? `Using the conversation model (${selection.effectiveModelId})`
        : 'Ready',
      tone: 'ready',
    };
  } else if (selection.effectiveModelId) {
    status = { text: 'The provider still needs setup', tone: 'pending' };
  } else {
    status = { text: 'Not selected', tone: 'pending' };
  }

  return (
    <div className="settings-models__job">
      <Stack spacing="1" className="settings-models__job-copy">
        <Row spacing="2" align="center" className="settings-models__job-title">
          <Text size="3" weight="semibold">
            {info.label}
          </Text>
          <span className="settings-models__status" data-tone={status.tone}>
            {status.text}
          </span>
        </Row>
        <Text size="1" tone="muted">
          {info.help}
        </Text>
      </Stack>

      <div className="settings-models__job-controls">
        <select
          value={providerId}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="settings-models__control"
          aria-label={`${info.label} provider`}
        >
          <option value="">{emptyLabel}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isConfigured ? '' : ' (needs setup)'}
            </option>
          ))}
          <option value={ADD_PROVIDER_OPTION}>Add provider…</option>
        </select>

        {providerId === '' ? null : showTextInput ? (
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="settings-models__control"
            placeholder="Model id"
            aria-label={`${info.label} model id`}
          />
        ) : (
          <select
            value={modelId}
            onChange={(e) => {
              if (e.target.value === CUSTOM_MODEL_OPTION) {
                setIsTypingModel(true);
                setModelId('');
                return;
              }
              setModelId(e.target.value);
            }}
            className="settings-models__control"
            aria-label={`${info.label} model`}
            disabled={listing?.status !== 'ready'}
          >
            <option value="">
              {listing?.status === 'ready' ? 'Choose a model' : 'Loading models…'}
            </option>
            {options.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
            <option value={CUSTOM_MODEL_OPTION}>Type a model id…</option>
          </select>
        )}

        <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
          {justSaved && !isDirty ? 'Saved' : 'Save'}
        </Button>
      </div>

      {providerId !== '' && listing?.status === 'error' ? (
        <Text size="1" tone="muted" className="settings-models__job-note">
          {listing.message} You can still type the model id.
        </Text>
      ) : null}
      {providerId !== '' && !canListModels ? (
        <Text size="1" tone="muted" className="settings-models__job-note">
          Finish setting up this provider to pick from its models.
        </Text>
      ) : null}
    </div>
  );
}

function ProviderCard({
  provider,
  usedBy,
  models,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onTest,
}: {
  provider: AiProviderResponseDto;
  usedBy: string[];
  models: ProviderModels | undefined;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (form: ProviderForm) => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const info = PROVIDER_TYPES[provider.type];
  const [form, setForm] = useState<ProviderForm>({
    name: '',
    apiKey: '',
    baseUrl: '',
    project: '',
    location: '',
  });
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [hasTested, setHasTested] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setForm({
        name: provider.name,
        apiKey: '',
        baseUrl: provider.baseUrl ?? '',
        project: provider.project ?? '',
        location: provider.location ?? '',
      });
    }
  }, [isEditing, provider]);

  const field = (label: string, key: keyof ProviderForm, placeholder: string) => (
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

  let testResult: string | null = null;
  if (hasTested && models) {
    testResult =
      models.status === 'loading'
        ? 'Testing…'
        : models.status === 'ready'
          ? `Connected. ${models.models.length} models available.`
          : models.message;
  }

  return (
    <Card padding="5" className="settings-panel-card">
      <Stack spacing="4">
        <Stack spacing="1" className="settings-models__header-copy">
          <Row spacing="2" align="center" className="settings-models__job-title">
            <Text size="3" weight="semibold">
              {provider.name}
            </Text>
            <span
              className="settings-models__status"
              data-tone={provider.isConfigured ? 'ready' : 'pending'}
            >
              {provider.isConfigured ? 'Ready' : 'Needs setup'}
            </span>
          </Row>
          <Text size="1" tone="muted">
            {info.label}
            {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
            {usedBy.length > 0 ? ` · Used by ${usedBy.join(', ')}` : ' · Not used by any job'}
          </Text>
        </Stack>

        {isEditing ? (
          <Stack spacing="3">
            <Text size="1" tone="muted">
              {info.help}
            </Text>
            {field('Name', 'name', info.label)}
            {info.secretLabel ? (
              <Stack spacing="2">
                <Text size="2" weight="medium">
                  {info.secretLabel}
                </Text>
                {info.multilineSecret ? (
                  <textarea
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    className="login-input settings-models__secret-textarea"
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
                  />
                )}
                <Text size="1" tone="muted">
                  {provider.secretId
                    ? 'A value is already stored. Leave empty to keep it.'
                    : 'Stored securely on the server.'}
                </Text>
              </Stack>
            ) : null}
            {info.hasBaseUrl ? field('Base URL', 'baseUrl', 'http://localhost:11434/v1') : null}
            {info.hasVertexSettings ? (
              <>
                {field('Project ID', 'project', 'From GOOGLE_CLOUD_PROJECT')}
                {field('Location', 'location', 'From GOOGLE_CLOUD_LOCATION')}
              </>
            ) : null}
            <Row spacing="2">
              <Button variant="primary" size="sm" onClick={() => onSave(form)}>
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : isConfirmingDelete ? (
          <Row spacing="2" align="center" className="settings-models__add-row">
            <Text size="2">Delete {provider.name}?</Text>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setIsConfirmingDelete(false);
                onDelete();
              }}
            >
              Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsConfirmingDelete(false)}>
              Cancel
            </Button>
          </Row>
        ) : (
          <Row spacing="2" align="center" className="settings-models__add-row">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {provider.isConfigured ? 'Edit' : 'Set up'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!provider.isConfigured}
              onClick={() => {
                setHasTested(true);
                onTest();
              }}
            >
              Test connection
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsConfirmingDelete(true)}>
              Delete
            </Button>
            {testResult ? (
              <Text size="1" tone="muted">
                {testResult}
              </Text>
            ) : null}
          </Row>
        )}
      </Stack>
    </Card>
  );
}
