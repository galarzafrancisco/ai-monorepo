import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import type {
  GithubConnectionResponseDto,
  GithubWebhookSettingsResponseDto,
  ResolvedGithubConnectionResponseDto,
} from '@taico/client/v2';
import { Button, Card, ErrorText, Popover, Row, Stack, Switch, Text } from '../../ui/primitives';
import { GithubWebhookFields, GITHUB_WEBHOOK_EVENTS } from '../../shared/components/GithubWebhookFields';
import { webhookDeliveryLabel, webhookSourceLabel } from '../../shared/helpers/githubWebhook';
import { GithubConnectionsService } from './api';
import { errorDetail } from './useProjects';
import type { Project, UpdateProjectInput } from './types';
import './ProjectGithubCard.css';

const AUTOMATIC = '';
/** While the setup panel is open, how often to check whether GitHub's ping arrived. */
const PING_CHECK_MS = 4000;

const MATCH_LABEL: Record<NonNullable<ResolvedGithubConnectionResponseDto['match']>, string> = {
  project: 'chosen for this project',
  owner: `it lists the repository's owner`,
  only_connection: 'it is the only connection',
};

/**
 * Which GitHub connection the project uses, and whether workers may use it.
 * Changes save straight away.
 */
export function ProjectGithubCard({
  project,
  onSave,
  onSaved,
}: {
  project: Project;
  onSave: (projectId: string, input: UpdateProjectInput) => Promise<Project>;
  onSaved: (project: Project) => void;
}) {
  const [connections, setConnections] = useState<GithubConnectionResponseDto[] | null>(null);
  const [resolved, setResolved] = useState<ResolvedGithubConnectionResponseDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false);
  const [resolveCount, setResolveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    GithubConnectionsService.GithubConnectionsController_listConnections()
      .then((data) => { if (!cancelled) setConnections(data); })
      .catch((err) => { if (!cancelled) setError(errorDetail(err, 'Failed to load GitHub connections')); });
    return () => { cancelled = true; };
  }, []);

  const repoUrl = project.repoUrl ?? '';
  const connectionId = project.githubConnectionId ?? undefined;
  useEffect(() => {
    if (!repoUrl) return;
    let cancelled = false;
    GithubConnectionsService.GithubConnectionsController_resolveConnection({ repoUrl, connectionId })
      .then((data) => { if (!cancelled) setResolved(data); })
      .catch(() => { if (!cancelled) setResolved(null); });
    return () => { cancelled = true; };
  }, [repoUrl, connectionId, resolveCount]);

  // Setting up a webhook: GitHub pings it once saved, which the status picks up.
  const waitingForPing = isSettingUpWebhook && !resolved?.webhook?.active;
  useEffect(() => {
    if (!waitingForPing) return;
    const timer = window.setInterval(() => setResolveCount((count) => count + 1), PING_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [waitingForPing]);

  const save = async (input: UpdateProjectInput) => {
    setIsSaving(true);
    setError('');
    try {
      onSaved(await onSave(project.id, input));
    } catch (err) {
      setError(errorDetail(err, 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  const isGithubRepo = !!repoUrl && resolved?.repository != null;
  const connection = isGithubRepo ? resolved?.connection ?? null : null;

  return (
    <Card padding="4">
      <Stack spacing="4">
        <Text size="3" weight="semibold">GitHub</Text>

        {connections !== null && connections.length === 0 ? (
          <Text size="2" tone="muted">
            No GitHub connection yet. <Link to="/settings/integrations">Connect GitHub</Link> to see
            the status of this project&apos;s pull requests and issues. Public repositories work without one,
            within GitHub&apos;s low limit for anonymous requests.
          </Text>
        ) : (
          <Stack spacing="2">
            <label htmlFor="project-github-connection">
              <Text size="1" tone="muted">Connection</Text>
            </label>
            <select
              id="project-github-connection"
              className="project-github__select"
              value={project.githubConnectionId ?? AUTOMATIC}
              disabled={isSaving || connections === null}
              onChange={(event) => { void save({ githubConnectionId: event.target.value || null }); }}
            >
              <option value={AUTOMATIC}>Automatic</option>
              {(connections ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}{option.accountLogin ? ` (@${option.accountLogin})` : ''}
                </option>
              ))}
            </select>
            {repoUrl && !isGithubRepo && resolved ? (
              <Text size="1" tone="muted">The repository is not on github.com or a GitHub Enterprise Taico has a connection to, so no connection is used.</Text>
            ) : !repoUrl ? (
              <Text size="1" tone="muted">Link a GitHub repository above to use a connection for it.</Text>
            ) : connection && resolved?.match ? (
              <Text size="1" tone="muted">
                Uses <strong>{connection.name}</strong> because {MATCH_LABEL[resolved.match]}.
              </Text>
            ) : resolved ? (
              <Text size="1" tone="muted">
                No connection fits this repository. On github.com Taico reads it anonymously, which only works if it is public.
              </Text>
            ) : null}
          </Stack>
        )}

        {isGithubRepo && resolved?.repository ? (
          <WebhookStatus
            resolved={resolved}
            repository={resolved.repository}
            connection={connection}
            isSettingUp={isSettingUpWebhook}
            onSetUp={setIsSettingUpWebhook}
          />
        ) : null}

        <Text size="1" tone="muted" className="project-github__notice">
          Taico uses this connection to check every pull request and issue linked in Taico: in task
          links, descriptions, comments and threads. Everyone in this Taico sees their status and
          title, even people without access to the repository on GitHub.
        </Text>

        <Row justify="space-between" align="center" spacing="3">
          <Row spacing="1" align="center">
            <label htmlFor="project-github-worker">
              <Text size="2" weight="medium">Workers use this connection</Text>
            </label>
            <Popover
              trigger={<CircleHelp size={14} strokeWidth={1.8} aria-hidden="true" />}
              triggerLabel="About workers and GitHub"
              triggerClassName="project-github__help"
            >
              <Stack spacing="2">
                <Text size="2">
                  On: when a worker picks up a task in this project, Taico gives it a token from this
                  connection to clone the repository, push branches and open pull requests. A GitHub
                  App gives a token that lasts an hour and only reaches this repository. A personal
                  access token is handed over as is, and reaches everything it can.
                </Text>
                <Text size="2">
                  Off: workers use whatever git and gh credentials the machine they run on already
                  has, if any.
                </Text>
              </Stack>
            </Popover>
          </Row>
          <Switch
            id="project-github-worker"
            checked={project.githubForWorker}
            disabled={isSaving}
            onCheckedChange={(checked) => { void save({ githubForWorker: checked }); }}
          />
        </Row>

        {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}
      </Stack>
    </Card>
  );
}

/**
 * Whether GitHub tells Taico about this repository's pull requests (a webhook
 * on the repository or its whole owner), or Taico polls for them; with a
 * guided setup for a repository webhook.
 */
function WebhookStatus({
  resolved,
  repository,
  connection,
  isSettingUp,
  onSetUp,
}: {
  resolved: ResolvedGithubConnectionResponseDto;
  repository: { owner: string; repo: string };
  connection: GithubConnectionResponseDto | null;
  isSettingUp: boolean;
  onSetUp: (open: boolean) => void;
}) {
  const webhook = resolved.webhook;
  const active = webhook?.active ?? false;

  return (
    <Stack spacing="2">
      <Row justify="space-between" align="center" spacing="3">
        <Stack spacing="1">
          <Text size="2" weight="medium">Updates</Text>
          {active && webhook ? (
            <Text size="1" tone="muted">
              Webhook ({webhook.repo ? 'on this repository' : webhookSourceLabel(webhook)}): {webhookDeliveryLabel(webhook)}.
              GitHub tells Taico within seconds; polling is a slow safety net.
            </Text>
          ) : (
            <Text size="1" tone="muted">
              Polling: every 30 s to 5 min depending on use.
              {webhook ? ` The webhook has been ${webhookDeliveryLabel(webhook)}.` : ' Add a webhook for instant updates.'}
            </Text>
          )}
        </Stack>
        {!active && connection && !isSettingUp ? (
          <Button variant="secondary" size="sm" onClick={() => onSetUp(true)}>
            Set up webhook
          </Button>
        ) : null}
      </Row>
      {!active && !connection ? (
        <Text size="1" tone="muted">
          A webhook needs a GitHub connection: <Link to="/settings/integrations">connect GitHub</Link> first.
        </Text>
      ) : null}
      {isSettingUp && connection ? (
        <WebhookSetup
          connection={connection}
          repository={repository}
          active={active}
          onClose={() => onSetUp(false)}
        />
      ) : null}
    </Stack>
  );
}

function WebhookSetup({
  connection,
  repository,
  active,
  onClose,
}: {
  connection: GithubConnectionResponseDto;
  repository: { owner: string; repo: string };
  active: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<GithubWebhookSettingsResponseDto | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    GithubConnectionsService.GithubConnectionsController_getWebhookSettings({ id: connection.id })
      .then((data) => { if (!cancelled) setSettings(data); })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number })?.status === 403) setForbidden(true);
        else setError(errorDetail(err, 'Failed to load the webhook settings'));
      });
    return () => { cancelled = true; };
  }, [connection.id]);

  const { owner, repo } = repository;
  const newHookUrl = `${connection.baseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/settings/hooks/new`;
  const orgHooksUrl = `${connection.baseUrl}/organizations/${encodeURIComponent(owner)}/settings/hooks`;

  return (
    <Stack spacing="3" className="project-github__webhook">
      {forbidden ? (
        <Text size="2" tone="muted">
          Only people who can manage integrations see the webhook secret. Ask one of them to add the
          webhook from here or from Settings &gt; Integrations.
        </Text>
      ) : error ? (
        <ErrorText size="2">{error}</ErrorText>
      ) : !settings ? (
        <Text size="2" tone="muted">Loading…</Text>
      ) : connection.authType === 'app' ? (
        <Text size="2" tone="muted">
          {connection.name} is a GitHub App: its webhook is set up once, in the App&apos;s settings, and
          covers every repository the app is installed on. See Settings &gt; Integrations &gt; Webhook.
        </Text>
      ) : (
        <>
          <Text size="2">
            1. Open{' '}
            <a href={newHookUrl} target="_blank" rel="noopener noreferrer">
              {owner}/{repo} &gt; Settings &gt; Webhooks &gt; Add webhook
            </a>{' '}
            (you need admin rights on the repository).
          </Text>
          <Text size="2">2. Paste the payload URL, set the content type to application/json, and paste the secret:</Text>
          <GithubWebhookFields url={settings.url} secret={settings.secret} />
          <Text size="2">
            3. Choose &quot;Let me select individual events&quot; and tick: {GITHUB_WEBHOOK_EVENTS.join(', ')}. Save.
          </Text>
          <Text size="1" tone="muted">
            {active
              ? 'GitHub pinged Taico: the webhook works.'
              : "Waiting for GitHub's ping… It arrives as soon as the webhook is saved."}
          </Text>
          <Text size="1" tone="muted">
            If {owner} is an organization, one{' '}
            <a href={orgHooksUrl} target="_blank" rel="noopener noreferrer">organization webhook</a>{' '}
            with the same URL and secret covers all its repositories instead.
          </Text>
        </>
      )}
      <Row>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {active ? 'Done' : 'Close'}
        </Button>
      </Row>
    </Stack>
  );
}
