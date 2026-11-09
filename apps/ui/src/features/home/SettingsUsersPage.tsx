import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Shield, UserPlus } from 'lucide-react';
import { WebAuthenticationService } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useHomeCtx } from './HomeProvider';
import { CreateManagedUserRequestDto, type ManagedUserResponseDto } from '@taico/client';
import '../../auth/LoginPage.css';
import './SettingsPage.css';
import './SettingsUsersPage.css';

type UserRole = CreateManagedUserRequestDto.role;

export function SettingsUsersPage() {
  const { setSectionTitle } = useHomeCtx();
  const { user, isLoading: authIsLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUserResponseDto[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(CreateManagedUserRequestDto.role.STANDARD);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // The one-time setup link from the last create or reset: shown once, never stored.
  const [setupLink, setSetupLink] = useState<{ email: string; url: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSectionTitle('User Management');
  }, [setSectionTitle]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (authIsLoading || !isAdmin) return;
    void loadUsers();
  }, [authIsLoading, isAdmin]);

  const loadUsers = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await WebAuthenticationService.webAuthControllerListUsers();
      setUsers(result);
    } catch (err: any) {
      setError(readError(err, 'Failed to load users.'));
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const created = await WebAuthenticationService.webAuthControllerCreateUser({ email, role });
      setSetupLink({ email: created.email, url: created.setupUrl });
      setEmail('');
      setRole(CreateManagedUserRequestDto.role.STANDARD);
      setNotice('User created. Send them the setup link below: it sets their profile and password.');
      await loadUsers();
    } catch (err: any) {
      setError(readError(err, 'Failed to create user.'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetPassword = async (managedUser: ManagedUserResponseDto) => {
    setError('');
    setNotice('');
    try {
      const reset = await WebAuthenticationService.webAuthControllerResetUserPassword(managedUser.id);
      setSetupLink({ email: reset.email, url: reset.setupUrl });
      setNotice(`${managedUser.email} can set a new password with the setup link below.`);
      await loadUsers();
    } catch (err: any) {
      setError(readError(err, 'Failed to reset password.'));
    }
  };

  const deleteUser = async (managedUser: ManagedUserResponseDto) => {
    if (!window.confirm(`Disable login for ${managedUser.email}?`)) return;
    setError('');
    setNotice('');
    try {
      await WebAuthenticationService.webAuthControllerDeleteUser(managedUser.id);
      setNotice(`${managedUser.email} has been deactivated.`);
      await loadUsers();
    } catch (err: any) {
      setError(readError(err, 'Failed to delete user.'));
    }
  };

  if (authIsLoading) {
    return (
      <Card padding="5">
        <Text tone="muted">Loading user management...</Text>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card padding="5">
        <Stack spacing="2">
          <Text size="4" weight="semibold">Admin access required</Text>
          <Text tone="muted">Only admin users can manage user accounts.</Text>
        </Stack>
      </Card>
    );
  }

  return (
    <div className="settings-users-page">
      <Card padding="5" className="settings-users-page__hero">
        <Stack spacing="2">
          <span className="settings-users-page__hero-icon" aria-hidden="true"><Shield size={20} /></span>
          <Text size="5" weight="bold">User management</Text>
          <Text tone="muted">Invite human users, manage roles, reset passwords, and disable access.</Text>
        </Stack>
      </Card>

      <Card padding="5">
        <form onSubmit={createUser}>
          <Stack spacing="4">
            <Stack spacing="1">
              <Text size="3" weight="semibold">Create user</Text>
              <Text size="1" tone="muted">New users receive access by setting up their account from the login screen.</Text>
            </Stack>
            <div className="settings-users-page__create-grid">
              <Stack spacing="2">
                <label className="login-label" htmlFor="managed-user-email"><Text size="2" weight="medium">Email</Text></label>
                <input id="managed-user-email" className="login-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@work.com" required disabled={isSaving} />
              </Stack>
              <Stack spacing="2">
                <label className="login-label" htmlFor="managed-user-role"><Text size="2" weight="medium">Role</Text></label>
                <select id="managed-user-role" className="login-input" value={role} onChange={(event) => setRole(event.target.value as UserRole)} disabled={isSaving}>
                  <option value={CreateManagedUserRequestDto.role.STANDARD}>Normal user</option>
                  <option value={CreateManagedUserRequestDto.role.ADMIN}>Admin</option>
                </select>
              </Stack>
              <Button type="submit" variant="primary" disabled={isSaving} className="settings-users-page__create-button">
                <UserPlus size={16} />
                {isSaving ? 'Creating...' : 'Create user'}
              </Button>
            </div>
            {notice ? <Text size="2" tone="muted">{notice}</Text> : null}
            {setupLink ? (
              <Stack spacing="2">
                <Text size="2" weight="semibold">Setup link for {setupLink.email}</Text>
                <Text size="1" tone="muted">
                  Shown once. Send it yourself, by a channel you trust: it works once, within 7 days.
                </Text>
                <div className="settings-users-page__create-grid settings-users-page__invite-link">
                  <input className="login-input" readOnly value={setupLink.url} aria-label="Setup link" onFocus={(event) => event.currentTarget.select()} />
                  <Button type="button" variant="secondary" onClick={() => void navigator.clipboard?.writeText(setupLink.url)}>
                    Copy
                  </Button>
                </div>
              </Stack>
            ) : null}
            {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}
          </Stack>
        </form>
      </Card>

      <Card padding="0" className="settings-users-page__list-card">
        <div className="settings-users-page__list-header">
          <Text size="3" weight="semibold">Users</Text>
          <Button variant="secondary" size="sm" onClick={loadUsers} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
        </div>
        <div className="settings-users-page__list">
          {users.map((managedUser) => (
            <div className="settings-users-page__row" key={managedUser.id}>
              <div className="settings-users-page__identity">
                <Text size="2" weight="semibold">{managedUser.displayName}</Text>
                <Text size="1" tone="muted">{managedUser.email} · @{managedUser.slug}</Text>
              </div>
              <div className="settings-users-page__badges">
                <span className="settings-users-page__badge">{managedUser.role === 'admin' ? 'Admin' : 'Normal'}</span>
                <span className={`settings-users-page__badge ${managedUser.isActive ? 'settings-users-page__badge--active' : 'settings-users-page__badge--inactive'}`}>
                  {managedUser.isActive ? 'Active' : 'Inactive'}
                </span>
                {managedUser.passwordSetupPending ? <span className="settings-users-page__badge settings-users-page__badge--pending">Setup pending</span> : null}
              </div>
              <div className="settings-users-page__actions">
                <Button variant="secondary" size="sm" onClick={() => resetPassword(managedUser)} disabled={!managedUser.isActive}>Reset password</Button>
                <Button variant="secondary" size="sm" onClick={() => deleteUser(managedUser)} disabled={!managedUser.isActive || managedUser.actorId === user?.actorId}>Delete</Button>
              </div>
            </div>
          ))}
          {!isLoading && users.length === 0 ? <Text tone="muted" className="settings-users-page__empty">No users found.</Text> : null}
        </div>
      </Card>
    </div>
  );
}

function readError(err: any, fallback: string) {
  return err?.body?.detail || err?.body?.title || err?.message || fallback;
}
