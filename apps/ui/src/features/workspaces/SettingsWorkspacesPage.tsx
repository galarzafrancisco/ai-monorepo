import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useHomeCtx } from '../home/HomeProvider';
import { WorkspaceRole, WorkspacesService } from './api';
import { useWorkspacesCtx } from './WorkspacesProvider';
import { readApiError } from './readApiError';
import '../../auth/LoginPage.css';
import '../home/SettingsUsersPage.css';

/** Turns a name into a slug suggestion: lowercase letters, digits and hyphens. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Every workspace the person is in, with a way to switch to each. The
 * installation operator also creates workspaces here.
 */
export function SettingsWorkspacesPage() {
  const { setSectionTitle } = useHomeCtx();
  const { user } = useAuth();
  const { workspaces, switchTo, reload } = useWorkspacesCtx();
  const isOperator = user?.role === 'admin';
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    setSectionTitle('Workspaces');
  }, [setSectionTitle]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const workspace = await WorkspacesService.workspaceAdminControllerCreate({ name, slug });
      setName('');
      setSlug('');
      setSlugEdited(false);
      setNotice(`Created ${workspace.name}. You are its admin: switch to it to invite people and add an AI provider key.`);
      await reload();
    } catch (err) {
      setError(readApiError(err, 'Failed to create the workspace.'));
    } finally {
      setIsSaving(false);
    }
  };

  const onSwitch = async (workspaceId: string) => {
    setSwitchingId(workspaceId);
    setError('');
    try {
      await switchTo(workspaceId);
    } catch (err) {
      setError(readApiError(err, 'Could not switch workspace.'));
      setSwitchingId(null);
    }
  };

  return (
    <div className="settings-users-page">
      <Card padding="5" className="settings-users-page__hero">
        <Stack spacing="2">
          <span className="settings-users-page__hero-icon" aria-hidden="true"><Building2 size={20} /></span>
          <Text size="5" weight="bold">Workspaces</Text>
          <Text tone="muted">
            Each workspace has its own people, agents, tasks, threads, AI models and settings.
          </Text>
        </Stack>
      </Card>

      {isOperator ? (
        <Card padding="5">
          <form onSubmit={create}>
            <Stack spacing="4">
              <Stack spacing="1">
                <Text size="3" weight="semibold">Create a workspace</Text>
                <Text size="1" tone="muted">
                  Installation operators only. You become its first admin. It starts with the system tags, the taico agent and AI providers without keys.
                </Text>
              </Stack>
              <div className="settings-users-page__create-grid">
                <Stack spacing="2">
                  <label className="login-label" htmlFor="workspace-create-name"><Text size="2" weight="medium">Name</Text></label>
                  <input
                    id="workspace-create-name"
                    className="login-input"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!slugEdited) setSlug(slugify(event.target.value));
                    }}
                    placeholder="Acme"
                    maxLength={100}
                    required
                    disabled={isSaving}
                  />
                </Stack>
                <Stack spacing="2">
                  <label className="login-label" htmlFor="workspace-create-slug"><Text size="2" weight="medium">Slug</Text></label>
                  <input
                    id="workspace-create-slug"
                    className="login-input"
                    value={slug}
                    onChange={(event) => {
                      setSlug(event.target.value);
                      setSlugEdited(true);
                    }}
                    placeholder="acme"
                    pattern="[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?"
                    title="Lowercase letters, digits and hyphens"
                    maxLength={50}
                    required
                    disabled={isSaving}
                  />
                </Stack>
                <Button type="submit" variant="primary" disabled={isSaving} className="settings-users-page__create-button">
                  <Plus size={16} />
                  {isSaving ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </Stack>
          </form>
        </Card>
      ) : null}

      {notice ? <Text size="2" tone="muted">{notice}</Text> : null}
      {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}

      <Card padding="0" className="settings-users-page__list-card">
        <div className="settings-users-page__list-header">
          <Text size="3" weight="semibold">Your workspaces</Text>
        </div>
        <div className="settings-users-page__list">
          {workspaces.map((workspace) => (
            <div className="settings-users-page__row" key={workspace.id}>
              <div className="settings-users-page__identity">
                <Text size="2" weight="semibold">{workspace.name}</Text>
                <Text size="1" tone="muted">@{workspace.slug}</Text>
              </div>
              <div className="settings-users-page__badges">
                <span className="settings-users-page__badge">{workspace.role === WorkspaceRole.ADMIN ? 'Admin' : 'Member'}</span>
                {workspace.current ? <span className="settings-users-page__badge settings-users-page__badge--active">Current</span> : null}
              </div>
              <div className="settings-users-page__actions">
                {workspace.current ? null : (
                  <Button variant="secondary" size="sm" onClick={() => void onSwitch(workspace.id)} disabled={switchingId !== null}>
                    {switchingId === workspace.id ? 'Switching...' : 'Switch'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
