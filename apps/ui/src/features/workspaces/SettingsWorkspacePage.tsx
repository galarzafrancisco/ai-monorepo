import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Copy, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useHomeCtx } from '../home/HomeProvider';
import {
  WorkspaceMemberActorType,
  WorkspaceRole,
  WorkspacesService,
  type WorkspaceInvitationResponseDto,
  type WorkspaceMemberResponseDto,
} from './api';
import { useWorkspacesCtx } from './WorkspacesProvider';
import { readApiError } from './readApiError';
import '../../auth/LoginPage.css';
import '../home/SettingsUsersPage.css';

/**
 * The current workspace and its members. Everyone can see who is in it;
 * workspace admins invite people, change roles and remove them.
 */
export function SettingsWorkspacePage() {
  const { setSectionTitle } = useHomeCtx();
  const { user } = useAuth();
  const { current, isWorkspaceAdmin, isLoading: workspacesLoading } = useWorkspacesCtx();
  const [members, setMembers] = useState<WorkspaceMemberResponseDto[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationResponseDto[]>([]);
  // The one-time link from the last invite: shown once, never stored.
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>(WorkspaceRole.MEMBER);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSectionTitle('Workspace');
  }, [setSectionTitle]);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      setMembers(await WorkspacesService.workspaceAdminControllerListMembers());
      if (isWorkspaceAdmin) {
        setInvitations(await WorkspacesService.workspaceAdminControllerListInvitations());
      }
    } catch (err) {
      setError(readApiError(err, 'Failed to load members.'));
    } finally {
      setIsLoading(false);
    }
  }, [isWorkspaceAdmin]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const run = async (action: () => Promise<string>) => {
    setError('');
    setNotice('');
    try {
      setNotice(await action());
      await loadMembers();
    } catch (err) {
      setError(readApiError(err, 'Something went wrong.'));
    }
  };

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    await run(async () => {
      const result = await WorkspacesService.workspaceAdminControllerInvite({ email, role });
      setInviteLink({ email: result.invitation.email, url: result.inviteUrl });
      setEmail('');
      setRole(WorkspaceRole.MEMBER);
      return `Invited ${result.invitation.email}. They join when they open the invite link below.`;
    });
    setIsSaving(false);
  };

  const changeRole = (member: WorkspaceMemberResponseDto, nextRole: WorkspaceRole) =>
    run(async () => {
      await WorkspacesService.workspaceAdminControllerUpdateMember(member.actorId, { role: nextRole });
      return `${member.displayName} is now ${roleLabel(nextRole).toLowerCase()}. It applies from their next sign-in or token refresh.`;
    });

  const revoke = (invitation: WorkspaceInvitationResponseDto) => {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}? Its link stops working.`)) return;
    void run(async () => {
      await WorkspacesService.workspaceAdminControllerRevokeInvitation(invitation.id);
      return `The invitation for ${invitation.email} was revoked.`;
    });
  };

  const remove = (member: WorkspaceMemberResponseDto) => {
    if (!window.confirm(`Remove ${member.displayName} from ${current?.name ?? 'this workspace'}?`)) return;
    void run(async () => {
      await WorkspacesService.workspaceAdminControllerRemoveMember(member.actorId);
      return `${member.displayName} was removed. Their current session keeps access until it expires.`;
    });
  };

  if (workspacesLoading) {
    return (
      <Card padding="5">
        <Text tone="muted">Loading workspace...</Text>
      </Card>
    );
  }

  const people = members.filter((member) => member.type === WorkspaceMemberActorType.HUMAN);
  const agents = members.filter((member) => member.type !== WorkspaceMemberActorType.HUMAN);

  return (
    <div className="settings-users-page">
      <Card padding="5" className="settings-users-page__hero">
        <Stack spacing="2">
          <span className="settings-users-page__hero-icon" aria-hidden="true"><Building2 size={20} /></span>
          <Text size="5" weight="bold">{current?.name ?? 'Workspace'}</Text>
          <Text tone="muted">
            {current ? `@${current.slug} · You are ${roleLabel(current.role).toLowerCase()}.` : null}{' '}
            {isWorkspaceAdmin
              ? 'Invite people, change their role and remove them.'
              : 'Only workspace admins can invite or remove people.'}
          </Text>
        </Stack>
      </Card>

      {isWorkspaceAdmin ? (
        <Card padding="5">
          <form onSubmit={invite}>
            <Stack spacing="4">
              <Stack spacing="1">
                <Text size="3" weight="semibold">Invite a person</Text>
                <Text size="1" tone="muted">
                  Inviting adds nobody yet: you get a one-time link to give the person. They open it to join, signing in to their account or creating one.
                </Text>
              </Stack>
              <div className="settings-users-page__create-grid">
                <Stack spacing="2">
                  <label className="login-label" htmlFor="workspace-invite-email"><Text size="2" weight="medium">Email</Text></label>
                  <input id="workspace-invite-email" className="login-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@work.com" required disabled={isSaving} />
                </Stack>
                <Stack spacing="2">
                  <label className="login-label" htmlFor="workspace-invite-role"><Text size="2" weight="medium">Role</Text></label>
                  <select id="workspace-invite-role" className="login-input" value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)} disabled={isSaving}>
                    <option value={WorkspaceRole.MEMBER}>Member</option>
                    <option value={WorkspaceRole.ADMIN}>Admin</option>
                  </select>
                </Stack>
                <Button type="submit" variant="primary" disabled={isSaving} className="settings-users-page__create-button">
                  <UserPlus size={16} />
                  {isSaving ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
            </Stack>
          </form>
        </Card>
      ) : null}

      {notice ? <Text size="2" tone="muted">{notice}</Text> : null}

      {inviteLink ? (
        <Card padding="5">
          <Stack spacing="3">
            <Text size="3" weight="semibold">Invite link for {inviteLink.email}</Text>
            <Text size="1" tone="muted">
              Shown once. Send it to them yourself, by a channel you trust: anyone with the link can use it, once, within 7 days.
            </Text>
            <div className="settings-users-page__create-grid settings-users-page__invite-link">
              <input className="login-input" readOnly value={inviteLink.url} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" variant="secondary" onClick={() => void navigator.clipboard?.writeText(inviteLink.url)}>
                <Copy size={16} />
                Copy
              </Button>
            </div>
          </Stack>
        </Card>
      ) : null}
      {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}

      {isWorkspaceAdmin && invitations.length > 0 ? (
        <Card padding="0" className="settings-users-page__list-card">
          <div className="settings-users-page__list-header">
            <Text size="3" weight="semibold">Pending invitations</Text>
            <Text size="1" tone="muted">Not joined yet. Links expire after 7 days.</Text>
          </div>
          <div className="settings-users-page__list">
            {invitations.map((invitation) => (
              <div className="settings-users-page__row" key={invitation.id}>
                <div className="settings-users-page__identity">
                  <Text size="2" weight="semibold">{invitation.email}</Text>
                  <Text size="1" tone="muted">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</Text>
                </div>
                <div className="settings-users-page__badges">
                  <span className="settings-users-page__badge settings-users-page__badge--pending">{roleLabel(invitation.role)}</span>
                </div>
                <div className="settings-users-page__actions">
                  <Button variant="secondary" size="sm" onClick={() => revoke(invitation)}>Revoke</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card padding="0" className="settings-users-page__list-card">
        <div className="settings-users-page__list-header">
          <Text size="3" weight="semibold">People</Text>
          <Button variant="secondary" size="sm" onClick={() => void loadMembers()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
        </div>
        <div className="settings-users-page__list">
          {people.map((member) => (
            <div className="settings-users-page__row" key={member.actorId}>
              <div className="settings-users-page__identity">
                <Text size="2" weight="semibold">{member.displayName}</Text>
                <Text size="1" tone="muted">@{member.slug}{member.actorId === user?.actorId ? ' · You' : ''}</Text>
              </div>
              <div className="settings-users-page__badges">
                {isWorkspaceAdmin ? (
                  <select
                    className="login-input settings-users-page__role-select"
                    aria-label={`Role of ${member.displayName}`}
                    value={member.role}
                    onChange={(event) => void changeRole(member, event.target.value as WorkspaceRole)}
                  >
                    <option value={WorkspaceRole.MEMBER}>Member</option>
                    <option value={WorkspaceRole.ADMIN}>Admin</option>
                  </select>
                ) : (
                  <span className="settings-users-page__badge">{roleLabel(member.role)}</span>
                )}
              </div>
              <div className="settings-users-page__actions">
                {isWorkspaceAdmin ? (
                  <Button variant="secondary" size="sm" onClick={() => remove(member)}>Remove</Button>
                ) : null}
              </div>
            </div>
          ))}
          {!isLoading && people.length === 0 ? <Text tone="muted" className="settings-users-page__empty">No people yet.</Text> : null}
        </div>
      </Card>

      <Card padding="0" className="settings-users-page__list-card">
        <div className="settings-users-page__list-header">
          <Text size="3" weight="semibold">Agents</Text>
          <Text size="1" tone="muted">Agents are created and deleted on the Agents page.</Text>
        </div>
        <div className="settings-users-page__list">
          {agents.map((member) => (
            <div className="settings-users-page__row" key={member.actorId}>
              <div className="settings-users-page__identity">
                <Text size="2" weight="semibold">{member.displayName}</Text>
                <Text size="1" tone="muted">@{member.slug}</Text>
              </div>
              <div className="settings-users-page__badges" />
              <div className="settings-users-page__actions" />
            </div>
          ))}
          {!isLoading && agents.length === 0 ? <Text tone="muted" className="settings-users-page__empty">No agents yet.</Text> : null}
        </div>
      </Card>
    </div>
  );
}

function roleLabel(role: WorkspaceRole): string {
  return role === WorkspaceRole.ADMIN ? 'Admin' : 'Member';
}
