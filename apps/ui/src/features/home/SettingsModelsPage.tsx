import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AiModelSelectionsService,
  AiProvidersService,
  type AiModelSelectionResponseDto,
  type AiProviderModelResponseDto,
  type AiProviderResponseDto,
} from '@taico/client';
import { Stack, Text, Card, Button, Modal, Row } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useHomeCtx } from './HomeProvider';
import { ChatgptConnection } from '../ai-models/ChatgptConnection';
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
  /**
   * Runs on each person's own plan instead of shared credentials. Such a
   * provider only answers in threads, so it is offered for the conversation only.
   */
  personalPlan?: boolean;
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
  xai: {
    label: 'xAI (Grok)',
    help: 'Get an API key from console.x.ai.',
    secretLabel: 'API key',
    secretPlaceholder: 'xai-...',
    secretRequired: true,
  },
  openai_compatible: {
    label: 'OpenAI-compatible',
    help: 'Any server that speaks the OpenAI chat API, such as Ollama, LiteLLM or OpenRouter. Needs a base URL.',
    secretLabel: 'API key (optional)',
    secretPlaceholder: 'sk-...',
    secretRequired: false,
    hasBaseUrl: true,
  },
  chatgpt_subscription: {
    label: 'ChatGPT plan (Sign in with ChatGPT)',
    help: 'No API key. Each person signs in with their own ChatGPT account, and their plan answers the messages they write in threads. Only for a Taico you run yourself, not a hosted one.',
    secretLabel: null,
    secretPlaceholder: '',
    secretRequired: false,
    personalPlan: true,
  },
};

const CREATABLE_TYPES = Object.keys(PROVIDER_TYPES) as ProviderType[];

const ADD_PROVIDER_OPTION = '__add_provider__';

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
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const requestedModels = useRef(new Set<string>());
  // Set by the page that finishes a ChatGPT sign-in, to confirm it once.
  const justConnectedChatgpt =
    (useLocation().state as { chatgptConnected?: boolean } | null)?.chatgptConnected === true;

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

  /** Returns an error message, or null when the provider was added. */
  const handleAddProvider = async (type: ProviderType, form: ProviderForm) => {
    const invalid = validateProviderForm(type, form, false);
    if (invalid) {
      return invalid;
    }

    const info = PROVIDER_TYPES[type];
    try {
      const created = await AiProvidersService.aiProvidersControllerCreateAiProvider({
        name: form.name.trim() || info.label,
        type: type as never,
        ...(info.hasBaseUrl ? { baseUrl: form.baseUrl } : {}),
        ...(info.hasVertexSettings ? { project: form.project, location: form.location } : {}),
      });
      if (form.apiKey.trim()) {
        await AiProvidersService.aiProvidersControllerUpdateAiProvider(created.id, {
          apiKey: form.apiKey.trim(),
        });
      }
      setIsAddingProvider(false);
      await loadData();
      return null;
    } catch (err) {
      // The provider may exist without its key; show it so it can be finished or deleted.
      await loadData();
      return errorDetail(err, 'Failed to add provider');
    }
  };

  const handleSaveProvider = async (provider: AiProviderResponseDto, form: ProviderForm) => {
    const info = PROVIDER_TYPES[provider.type];

    const invalid = form.name.trim()
      ? validateProviderForm(provider.type, form, !!provider.secretId)
      : 'Please enter a name';
    if (invalid) {
      setError(invalid);
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

  const conversationProvider = providers.find(
    (p) => p.id === selections.find((s) => s.job === 'conversation')?.aiProviderId,
  );
  const conversationUsesPersonalPlan =
    !!conversationProvider && !!PROVIDER_TYPES[conversationProvider.type].personalPlan;

  const jobsByProvider = (providerId: string): string[] =>
    JOBS.filter((info) =>
      selections.some((s) => s.job === info.job && s.aiProviderId === providerId),
    ).map((info) => info.label);

  return (
    <Stack spacing="6" className="settings-subpage settings-models">
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
                  conversationUsesPersonalPlan={conversationUsesPersonalPlan}
                  modelsByProvider={modelsByProvider}
                  onLoadModels={loadModels}
                  onSave={(providerId, modelId) =>
                    handleSaveSelection(info.job, providerId, modelId)
                  }
                  onAddProvider={() => setIsAddingProvider(true)}
                />
              ) : null;
            })}
          </div>
        </Card>
      </Stack>

      <Stack spacing="3">
        <Row justify="space-between" align="center">
          <Text size="4" weight="semibold">
            Providers
          </Text>
          <Button variant="primary" size="sm" onClick={() => setIsAddingProvider(true)}>
            Add provider
          </Button>
        </Row>

        <Card padding="5" className="settings-panel-card">
          <div className="settings-models__jobs">
            {providers.length === 0 ? (
              <div className="settings-models__provider">
                <Text tone="muted">No providers yet. Add one to pick models from it.</Text>
              </div>
            ) : (
              providers.map((provider) => (
                <ProviderRow
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
                  justConnected={justConnectedChatgpt}
                />
              ))
            )}
          </div>
        </Card>
      </Stack>

      <AddProviderModal
        open={isAddingProvider}
        onOpenChange={setIsAddingProvider}
        onAdd={handleAddProvider}
      />
    </Stack>
  );
}

function validateProviderForm(
  type: ProviderType,
  form: ProviderForm,
  hasStoredSecret: boolean,
): string | null {
  const info = PROVIDER_TYPES[type];
  if (info.secretRequired && !hasStoredSecret && !form.apiKey.trim()) {
    return 'Please enter an API key';
  }
  if (info.hasBaseUrl && !form.baseUrl.trim()) {
    return 'Please enter a base URL';
  }
  return null;
}

const EMPTY_PROVIDER_FORM: ProviderForm = {
  name: '',
  apiKey: '',
  baseUrl: '',
  project: '',
  location: '',
};

function ProviderFields({
  type,
  form,
  onChange,
  hasStoredSecret,
}: {
  type: ProviderType;
  form: ProviderForm;
  onChange: (form: ProviderForm) => void;
  hasStoredSecret: boolean;
}) {
  const info = PROVIDER_TYPES[type];

  const field = (label: string, key: keyof ProviderForm, placeholder: string) => (
    <Stack spacing="2">
      <Text size="2" weight="medium">
        {label}
      </Text>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
        className="settings-models__control"
        placeholder={placeholder}
      />
    </Stack>
  );

  return (
    <>
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
              onChange={(e) => onChange({ ...form, apiKey: e.target.value })}
              className="settings-models__control settings-models__secret-textarea"
              placeholder={info.secretPlaceholder}
              rows={4}
            />
          ) : (
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => onChange({ ...form, apiKey: e.target.value })}
              className="settings-models__control"
              placeholder={info.secretPlaceholder}
            />
          )}
          <Text size="1" tone="muted">
            {hasStoredSecret
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
    </>
  );
}

function AddProviderModal({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: ProviderType, form: ProviderForm) => Promise<string | null>;
}) {
  const [type, setType] = useState<ProviderType>('anthropic');
  const [form, setForm] = useState<ProviderForm>(EMPTY_PROVIDER_FORM);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_PROVIDER_FORM);
      setError('');
    }
  }, [open]);

  const handleAdd = async () => {
    setIsAdding(true);
    setError((await onAdd(type, form)) ?? '');
    setIsAdding(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add a provider">
      <Stack spacing="3">
        <Stack spacing="2">
          <Text size="2" weight="medium">
            Type
          </Text>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as ProviderType);
              setError('');
            }}
            className="settings-models__control"
            aria-label="Provider type"
          >
            {CREATABLE_TYPES.map((option) => (
              <option key={option} value={option}>
                {PROVIDER_TYPES[option].label}
              </option>
            ))}
          </select>
        </Stack>
        <ProviderFields type={type} form={form} onChange={setForm} hasStoredSecret={false} />
        {error ? (
          <ErrorText size="2" weight="medium">
            {error}
          </ErrorText>
        ) : null}
        <Row spacing="2" justify="end">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={isAdding}>
            Add provider
          </Button>
        </Row>
      </Stack>
    </Modal>
  );
}

/**
 * Text field with a filtered list of suggestions under it. Any text is a valid
 * value, so a model the provider did not list can still be entered.
 */
function ModelCombobox({
  value,
  onChange,
  options,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // Until the user types, the field shows the saved model and the list shows everything.
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const query = value.trim().toLowerCase();
  const visible =
    isFiltering && query ? options.filter((id) => id.toLowerCase().includes(query)) : options;

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const close = () => {
    setIsOpen(false);
    setIsFiltering(false);
    setActiveIndex(-1);
  };

  const pick = (id: string) => {
    onChange(id);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (visible.length > 0) {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => (current + step + visible.length) % visible.length);
      }
    } else if (e.key === 'Enter' && isOpen && activeIndex >= 0 && visible[activeIndex]) {
      e.preventDefault();
      pick(visible[activeIndex]);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="settings-models__combobox">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        className="settings-models__control"
        onFocus={(e) => {
          setIsOpen(true);
          e.target.select();
        }}
        onBlur={close}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setIsFiltering(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && visible.length > 0 ? (
        <ul ref={listRef} role="listbox" className="settings-models__combobox-list">
          {visible.map((id, index) => (
            <li
              key={id}
              role="option"
              aria-selected={id === value}
              data-active={index === activeIndex}
              className="settings-models__combobox-option"
              // Keeps focus in the field so the blur does not close the list before the click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(id)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {id}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function JobRow({
  info,
  selection,
  providers,
  conversationUsesPersonalPlan,
  modelsByProvider,
  onLoadModels,
  onSave,
  onAddProvider,
}: {
  info: JobInfo;
  selection: AiModelSelectionResponseDto;
  providers: AiProviderResponseDto[];
  /** True when the conversation runs on each person's own plan, which other jobs do not inherit. */
  conversationUsesPersonalPlan: boolean;
  modelsByProvider: Record<string, ProviderModels>;
  onLoadModels: (providerId: string) => void;
  onSave: (providerId: string, modelId: string) => Promise<boolean>;
  onAddProvider: () => void;
}) {
  const savedProviderId = selection.aiProviderId ?? '';
  const savedModelId = selection.modelId ?? '';
  const [providerId, setProviderId] = useState(savedProviderId);
  const [modelId, setModelId] = useState(savedModelId);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setProviderId(savedProviderId);
    setModelId(savedModelId);
  }, [savedProviderId, savedModelId]);

  const provider = providers.find((p) => p.id === providerId);
  const canListModels = !!provider?.isConfigured;
  const usesPersonalPlan = !!provider && !!PROVIDER_TYPES[provider.type].personalPlan;
  // A person's plan answers that person's messages in threads and nothing else.
  const selectableProviders = providers.filter(
    (p) => info.job === 'conversation' || !PROVIDER_TYPES[p.type].personalPlan,
  );
  const cannotFollowConversation =
    info.followsConversation && providerId === '' && conversationUsesPersonalPlan;

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
  const isLoadingModels = canListModels && listing?.status !== 'ready' && listing?.status !== 'error';

  const isDirty = providerId !== savedProviderId || modelId.trim() !== savedModelId;
  const canSave = isDirty && !isSaving && (providerId === '' || modelId.trim() !== '');

  const handleProviderChange = (value: string) => {
    if (value === ADD_PROVIDER_OPTION) {
      onAddProvider();
      return;
    }
    setProviderId(value);
    setModelId(value === savedProviderId ? savedModelId : '');
  };

  const handleSave = async () => {
    setIsSaving(true);
    const saved = await onSave(providerId, modelId.trim());
    setIsSaving(false);
    setJustSaved(saved);
  };

  const emptyLabel =
    info.followsConversation && !cannotFollowConversation ? 'Same as Conversation' : 'Not selected';

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
          {selectableProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isConfigured ? '' : ' (needs setup)'}
            </option>
          ))}
          <option value={ADD_PROVIDER_OPTION}>Add provider…</option>
        </select>

        {providerId === '' ? null : (
          <ModelCombobox
            value={modelId}
            onChange={setModelId}
            options={options}
            placeholder={isLoadingModels ? 'Loading models…' : 'Search or type a model id'}
            label={`${info.label} model`}
          />
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
      {usesPersonalPlan ? (
        <Text size="1" tone="muted" className="settings-models__job-note">
          Using ChatGPT plan: each person's own plan answers the messages they write. Someone who
          has not connected their account gets a note in the thread instead of an answer. Models
          listed are the ones your own account offers.
        </Text>
      ) : null}
      {cannotFollowConversation ? (
        <Text size="1" tone="muted" className="settings-models__job-note">
          The ChatGPT plan only answers in threads, so this job does not use it. Pick a model from
          another provider, or leave it off.
        </Text>
      ) : null}
    </div>
  );
}

function ProviderRow({
  provider,
  usedBy,
  models,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onTest,
  justConnected,
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
  justConnected: boolean;
}) {
  const info = PROVIDER_TYPES[provider.type];
  const notReadyLabel = info.personalPlan ? 'Turned off on this server' : 'Needs setup';
  const [form, setForm] = useState<ProviderForm>(EMPTY_PROVIDER_FORM);
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
    <div className="settings-models__provider" data-layout={isEditing ? 'form' : 'row'}>
      <Stack spacing="3">
        <Stack spacing="1" className="settings-models__header-copy">
          <Row spacing="2" align="center" className="settings-models__job-title">
            <Text size="3" weight="semibold">
              {provider.name}
            </Text>
            <span
              className="settings-models__status"
              data-tone={provider.isConfigured ? 'ready' : 'pending'}
            >
              {provider.isConfigured ? 'Ready' : notReadyLabel}
            </span>
          </Row>
          <Text size="1" tone="muted">
            {info.label}
            {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
            {usedBy.length > 0 ? ` · Used by ${usedBy.join(', ')}` : ' · Not used by any job'}
          </Text>
          {testResult && !isEditing ? (
            <Text size="1" tone="muted">
              {testResult}
            </Text>
          ) : null}
        </Stack>

        {isEditing ? (
          <Stack spacing="3">
            <ProviderFields
              type={provider.type}
              form={form}
              onChange={setForm}
              hasStoredSecret={!!provider.secretId}
            />
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
          <Row spacing="2" align="center" className="settings-models__actions">
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
          <Row spacing="2" align="center" className="settings-models__actions">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {provider.isConfigured || info.personalPlan ? 'Edit' : 'Set up'}
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
          </Row>
        )}

        {info.personalPlan && !isEditing ? (
          <ChatgptConnection
            providerId={provider.id}
            isEnabled={provider.isConfigured}
            justConnected={justConnected}
            onChanged={onTest}
          />
        ) : null}
      </Stack>
    </div>
  );
}
