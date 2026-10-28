import { useCallback, useEffect, useState } from 'react';
import {
  IntegrationsGitHubService,
  type GithubAuthType,
  type GithubConnectionResponseDto,
  type GithubWebhookSettingsResponseDto,
} from '@taico/client';
import { Stack, Text, Card, Button, Modal, Row } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useHomeCtx } from './HomeProvider';
import { GithubWebhookFields, GITHUB_WEBHOOK_EVENTS } from '../../shared/components/GithubWebhookFields';
import { webhookDeliveryLabel, webhookSourceLabel } from '../../shared/helpers/githubWebhook';
import './SettingsPage.css';
import './SettingsModelsPage.css';
import './SettingsIntegrationsPage.css';

type AuthType = `${GithubAuthType}`;

type ConnectionForm = {
  authType: AuthType;
  name: string;
  /** Where the GitHub is: empty for github.com, else a GitHub Enterprise address. */
  baseUrl: string;
  /** The token, or the App's PEM private key. */
  secret: string;
  appId: string;
  installationId: string;
  /** Comma or space separated. */
  owners: string;
};

const AUTH_TYPES: Record<AuthType, { label: string; secretLabel: string; help: string }> = {
  pat: {
    label: 'Personal access token',
    secretLabel: 'Token',
    help:
      'Quickest to set up. Create a fine-grained token at github.com/settings/personal-access-tokens (or the same page on your GitHub Enterprise) with read access to Pull requests, Commit statuses and Checks (add Contents read and write if workers should clone and push). Taico acts as you.',
  },
  app: {
    label: 'GitHub App',
    secretLabel: 'Private key (.pem)',
    help:
      'Create an app at github.com/settings/apps/new (or under your organization), give it the same permissions, generate a private key and install it. The installation id is the number at the end of the installation page URL. Taico acts as the app and hands workers short-lived tokens.',
  },
};

const EMPTY_FORM: ConnectionForm = {
  authType: 'pat',
  name: '',
  baseUrl: '',
  secret: '',
  appId: '',
  installationId: '',
  owners: '',
};

const errorDetail = (err: unknown, fallback: string): string =>
  (err as { body?: { detail?: string } })?.body?.detail || fallback;

const parseOwners = (value: string): string[] =>
  value
    .split(/[\s,]+/)
    .map((owner) => owner.trim())
    .filter(Boolean);

export function SettingsIntegrationsPage() {
  const { setSectionTitle } = useHomeCtx();
  const [connections, setConnections] = useState<GithubConnectionResponseDto[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useDocumentTitle();

  const loadData = useCallback(async () => {
    try {
      setConnections(await IntegrationsGitHubService.githubConnectionsControllerListConnections());
    } catch (err) {
      setError(errorDetail(err, 'Failed to load integrations'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSectionTitle('Integrations');
    void loadData();
  }, [loadData, setSectionTitle]);

  /** Returns an error message, or null when the connection was added. */
  const handleAdd = async (form: ConnectionForm): Promise<string | null> => {
    const invalid = validateForm(form, false);
    if (invalid) return invalid;
    try {
      await IntegrationsGitHubService.githubConnectionsControllerCreateConnection({
        name: form.name.trim() || AUTH_TYPES[form.authType].label,
        baseUrl: form.baseUrl.trim() || null,
        authType: form.authType as GithubAuthType,
        secret: form.secret.trim(),
        ...(form.authType === 'app'
          ? { appId: form.appId.trim(), installationId: form.installationId.trim() }
          : {}),
        owners: parseOwners(form.owners),
      });
      setIsAdding(false);
      await loadData();
      return null;
    } catch (err) {
      return errorDetail(err, 'Failed to add the connection');
    }
  };

  /** Returns an error message, or null when saved. */
  const handleSave = async (
    connection: GithubConnectionResponseDto,
    form: ConnectionForm,
  ): Promise<string | null> => {
    const invalid = validateForm(form, true);
    if (invalid) return invalid;
    try {
      await IntegrationsGitHubService.githubConnectionsControllerUpdateConnection(connection.id, {
        name: form.name.trim() || connection.name,
        baseUrl: form.baseUrl.trim() || 'https://github.com',
        // An empty secret field keeps the stored one.
        ...(form.secret.trim() ? { secret: form.secret.trim() } : {}),
        ...(connection.authType === 'app'
          ? { appId: form.appId.trim(), installationId: form.installationId.trim() }
          : {}),
        owners: parseOwners(form.owners),
      });
      setEditingId(null);
      await loadData();
      return null;
    } catch (err) {
      return errorDetail(err, 'Failed to save the connection');
    }
  };

  const handleVerify = async (connection: GithubConnectionResponseDto) => {
    setError('');
    try {
      await IntegrationsGitHubService.githubConnectionsControllerVerifyConnection(connection.id);
      await loadData();
    } catch (err) {
      setError(errorDetail(err, 'Failed to check the connection'));
    }
  };

  const handleDelete = async (connection: GithubConnectionResponseDto) => {
    setError('');
    try {
      await IntegrationsGitHubService.githubConnectionsControllerDeleteConnection(connection.id);
      await loadData();
    } catch (err) {
      setError(errorDetail(err, 'Failed to delete the connection'));
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
    <Stack spacing="6" className="settings-subpage settings-models settings-integrations">
      <Text tone="muted" className="settings-subpage__intro">
        Connections let Taico talk to outside services. With GitHub connected, pull request links
        anywhere in Taico show whether they are open, merged, passing CI or approved, and threads
        can watch them. Everyone in this Taico can see that status.
      </Text>

      {error && (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      )}

      <Stack spacing="3">
        <Row justify="space-between" align="center">
          <Text size="4" weight="semibold">
            GitHub
          </Text>
          <Button variant="primary" size="sm" onClick={() => setIsAdding(true)}>
            Add connection
          </Button>
        </Row>

        <Card padding="5" className="settings-panel-card">
          <div className="settings-models__jobs">
            {connections.length === 0 ? (
              <div className="settings-models__provider">
                <Text tone="muted">
                  No GitHub connections yet. Public repositories still work, with GitHub&apos;s low
                  limit for anonymous requests.
                </Text>
              </div>
            ) : (
              connections.map((connection) => (
                <ConnectionRow
                  key={connection.id}
                  connection={connection}
                  isEditing={editingId === connection.id}
                  onEdit={() => {
                    setError('');
                    setEditingId(connection.id);
                  }}
                  onCancel={() => setEditingId(null)}
                  onSave={(form) => handleSave(connection, form)}
                  onVerify={() => handleVerify(connection)}
                  onDelete={() => handleDelete(connection)}
                />
              ))
            )}
          </div>
        </Card>
        <Text size="1" tone="muted">
          A repository uses the connection its project names. Otherwise Taico picks the connection
          that lists the repository&apos;s owner, or the only connection if there is just one.
        </Text>
      </Stack>

      <AddConnectionModal open={isAdding} onOpenChange={setIsAdding} onAdd={handleAdd} />
    </Stack>
  );
}

function validateForm(form: ConnectionForm, hasStoredSecret: boolean): string | null {
  if (!hasStoredSecret && !form.secret.trim()) {
    return form.authType === 'pat' ? 'Please enter a token' : 'Please paste the private key';
  }
  if (form.authType === 'app' && (!form.appId.trim() || !form.installationId.trim())) {
    return 'Please enter the app id and the installation id';
  }
  return null;
}

function ConnectionFields({
  form,
  onChange,
  hasStoredSecret,
}: {
  form: ConnectionForm;
  onChange: (form: ConnectionForm) => void;
  hasStoredSecret: boolean;
}) {
  const info = AUTH_TYPES[form.authType];

  const field = (label: string, key: keyof ConnectionForm, placeholder: string, help?: string) => (
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
      {help ? (
        <Text size="1" tone="muted">
          {help}
        </Text>
      ) : null}
    </Stack>
  );

  return (
    <>
      <Text size="1" tone="muted">
        {info.help}
      </Text>
      {field('Name', 'name', info.label)}
      {field(
        'GitHub address',
        'baseUrl',
        'https://github.com',
        'Leave empty for github.com, including organizations on GitHub Enterprise Cloud (github.com/your-org). Fill it in only if your company opens GitHub at its own address, such as https://github.acme.com (Enterprise Server) or https://acme.ghe.com (data residency).',
      )}
      {form.authType === 'app' ? (
        <>
          {field('App id', 'appId', '123456')}
          {field('Installation id', 'installationId', '7890123')}
        </>
      ) : null}
      <Stack spacing="2">
        <Text size="2" weight="medium">
          {info.secretLabel}
        </Text>
        {form.authType === 'app' ? (
          <textarea
            value={form.secret}
            onChange={(e) => onChange({ ...form, secret: e.target.value })}
            className="settings-models__control settings-models__secret-textarea"
            placeholder="-----BEGIN RSA PRIVATE KEY-----"
            rows={4}
          />
        ) : (
          <input
            type="password"
            value={form.secret}
            onChange={(e) => onChange({ ...form, secret: e.target.value })}
            className="settings-models__control"
            placeholder="github_pat_..."
          />
        )}
        <Text size="1" tone="muted">
          {hasStoredSecret
            ? 'A value is already stored. Leave empty to keep it.'
            : 'Checked with GitHub, then stored encrypted on the server. It is never shown again.'}
        </Text>
      </Stack>
      {field(
        'Repository owners',
        'owners',
        'acme, octocat',
        'Users or organizations whose repositories use this connection. Leave empty to use the account the credential belongs to.',
      )}
    </>
  );
}

function AddConnectionModal({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (form: ConnectionForm) => Promise<string | null>;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Connect GitHub">
      {/* Remounted each time it opens, so it starts empty. */}
      {open ? <AddConnectionForm onCancel={() => onOpenChange(false)} onAdd={onAdd} /> : null}
    </Modal>
  );
}

function AddConnectionForm({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (form: ConnectionForm) => Promise<string | null>;
}) {
  const [form, setForm] = useState<ConnectionForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    setIsAdding(true);
    setError((await onAdd(form)) ?? '');
    setIsAdding(false);
  };

  return (
    <Stack spacing="3">
      <Stack spacing="2">
        <Text size="2" weight="medium">
          Type
        </Text>
        <select
          value={form.authType}
          onChange={(e) => {
            setForm({ ...form, authType: e.target.value as AuthType, secret: '' });
            setError('');
          }}
          className="settings-models__control"
          aria-label="Connection type"
        >
          {(Object.keys(AUTH_TYPES) as AuthType[]).map((option) => (
            <option key={option} value={option}>
              {AUTH_TYPES[option].label}
            </option>
          ))}
        </select>
      </Stack>
      <ConnectionFields form={form} onChange={setForm} hasStoredSecret={false} />
      {error ? (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      ) : null}
      <Row spacing="2" justify="end">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleAdd} disabled={isAdding}>
          {isAdding ? 'Checking with GitHub…' : 'Connect'}
        </Button>
      </Row>
    </Stack>
  );
}

function EditConnectionForm({
  connection,
  onSave,
  onCancel,
}: {
  connection: GithubConnectionResponseDto;
  onSave: (form: ConnectionForm) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ConnectionForm>(() => ({
    authType: connection.authType,
    name: connection.name,
    baseUrl: connection.host === 'github.com' ? '' : connection.baseUrl,
    secret: '',
    appId: connection.appId ?? '',
    installationId: connection.installationId ?? '',
    owners: connection.owners.join(', '),
  }));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Stack spacing="3">
      <ConnectionFields form={form} onChange={setForm} hasStoredSecret />
      {error ? (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      ) : null}
      <Row spacing="2">
        <Button
          variant="primary"
          size="sm"
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            setError((await onSave(form)) ?? '');
            setIsSaving(false);
          }}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </Row>
    </Stack>
  );
}

function ConnectionRow({
  connection,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onVerify,
  onDelete,
}: {
  connection: GithubConnectionResponseDto;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (form: ConnectionForm) => Promise<string | null>;
  onVerify: () => void;
  onDelete: () => void;
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const isHealthy = !connection.lastError;
  const details = [
    AUTH_TYPES[connection.authType].label,
    connection.host === 'github.com' ? null : connection.host,
    connection.accountLogin ? `acts as @${connection.accountLogin}` : null,
    connection.owners.length > 0
      ? `used for ${connection.owners.join(', ')}`
      : 'used only by projects that name it',
  ].filter(Boolean);

  return (
    <div className="settings-models__provider" data-layout={isEditing ? 'form' : 'row'}>
      <Stack spacing="3">
        <Stack spacing="1" className="settings-models__header-copy">
          <Row spacing="2" align="center" className="settings-models__job-title">
            <Text size="3" weight="semibold">
              {connection.name}
            </Text>
            <span className="settings-models__status" data-tone={isHealthy ? 'ready' : 'pending'}>
              {isHealthy ? 'Connected' : 'Not working'}
            </span>
          </Row>
          <Text size="1" tone="muted">
            {details.join(' · ')}
          </Text>
          {connection.lastError && !isEditing ? (
            <ErrorText size="1">{connection.lastError}</ErrorText>
          ) : null}
        </Stack>

        {showWebhook && !isEditing ? <WebhookPanel connection={connection} /> : null}

        {isEditing ? (
          <EditConnectionForm connection={connection} onSave={onSave} onCancel={onCancel} />
        ) : isConfirmingDelete ? (
          <Row spacing="2" align="center" className="settings-models__actions">
            <Text size="2">Delete {connection.name}?</Text>
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
              Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={onVerify}>
              Check again
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showWebhook}
              onClick={() => setShowWebhook((current) => !current)}
            >
              Webhook
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsConfirmingDelete(true)}>
              Delete
            </Button>
          </Row>
        )}
      </Stack>
    </div>
  );
}

/**
 * Optional: with a webhook, GitHub tells Taico the moment a pull request
 * changes, and polling of the repositories it covers slows down to a safety net.
 * Taico learns which repositories a webhook covers from the deliveries.
 */
function WebhookPanel({ connection }: { connection: GithubConnectionResponseDto }) {
  const [settings, setSettings] = useState<GithubWebhookSettingsResponseDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    IntegrationsGitHubService.githubConnectionsControllerGetWebhookSettings(connection.id)
      .then((data) => { if (!cancelled) setSettings(data); })
      .catch((err) => { if (!cancelled) setError(errorDetail(err, 'Failed to load the webhook settings')); });
    return () => { cancelled = true; };
  }, [connection.id]);

  if (error) return <ErrorText size="2">{error}</ErrorText>;
  if (!settings) return <Text size="2" tone="muted">Loading…</Text>;

  const where =
    connection.authType === 'app'
      ? 'In the GitHub App settings, turn on Webhook, paste the URL and secret, and subscribe to:'
      : 'On GitHub, add a webhook to a repository or an organization with content type application/json, paste the URL and secret, and pick these events:';
  const reach =
    connection.authType === 'app'
      ? 'An App webhook covers every repository the app is installed on.'
      : 'A repository webhook covers that repository; an organization webhook (organization Settings > Webhooks) covers all its repositories at once. Repositories under a personal account can only be added one by one; the project page has a shortcut for each.';

  return (
    <Stack spacing="3" className="settings-integrations__webhook">
      <Text size="2" tone="muted">
        Optional. Without a webhook Taico polls GitHub; with one, it hears about changes within
        seconds and polls the repositories it covers much less. {where} {GITHUB_WEBHOOK_EVENTS.join(', ')}.
      </Text>
      <Text size="1" tone="muted">{reach}</Text>
      <GithubWebhookFields url={settings.url} secret={settings.secret} />
      <Stack spacing="1">
        <Text size="1" weight="medium">Receiving from</Text>
        {settings.sources.length === 0 ? (
          <Text size="1" tone="muted">
            Nothing yet. GitHub sends a ping when a webhook is saved, so it shows up here straight
            away; if it does not, GitHub cannot reach this address or the secret differs.
          </Text>
        ) : (
          settings.sources.map((source) => (
            <Text key={`${source.owner}/${source.repo ?? ''}`} size="1" tone={source.active ? 'default' : 'muted'}>
              <strong>{webhookSourceLabel(source)}</strong>: {webhookDeliveryLabel(source)}
            </Text>
          ))
        )}
      </Stack>
    </Stack>
  );
}
