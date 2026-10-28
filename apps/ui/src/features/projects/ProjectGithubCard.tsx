import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import type {
  GithubConnectionResponseDto,
  ResolvedGithubConnectionResponseDto,
} from '@taico/client/v2';
import { Card, ErrorText, Popover, Row, Stack, Switch, Text } from '../../ui/primitives';
import { GithubConnectionsService } from './api';
import { errorDetail } from './useProjects';
import type { Project, UpdateProjectInput } from './types';
import './ProjectGithubCard.css';

const AUTOMATIC = '';

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
  }, [repoUrl, connectionId]);

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
            the status of this project&apos;s pull requests. Public repositories work without one,
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

        <Text size="1" tone="muted" className="project-github__notice">
          Taico uses this connection to check every pull request linked in Taico: in task links,
          descriptions, comments and threads. Everyone in this Taico sees their status, title and
          size, even people without access to the repository on GitHub.
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
