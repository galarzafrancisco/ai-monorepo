import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { LoginShell } from '../../auth/LoginShell';
import { Button, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { WorkspaceRole, WorkspacesService, type InvitationPreviewResponseDto } from './api';
import { readApiError } from './readApiError';
import { switchWorkspaceAndReload } from './reloadInWorkspace';
import '../../auth/LoginPage.css';

/**
 * Opens a workspace invitation (`/invite?code=…`). The code is the only
 * thing that lets someone join: signed in, they accept it with the account
 * it was sent to; otherwise they sign in to that account, or create it here.
 * See docs/architecture/workspaces.md, "Invitations".
 */
export function InvitePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const code = new URLSearchParams(location.search).get('code') ?? '';
  const [preview, setPreview] = useState<InvitationPreviewResponseDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!code) {
      setError('This link has no invitation code.');
      return;
    }
    WorkspacesService.workspaceAdminControllerPreviewInvitation({ code })
      .then(setPreview)
      .catch((err) => setError(readApiError(err, 'This invitation is not valid. It may have been used, revoked or expired.')));
  }, [code]);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const joined = await WorkspacesService.workspaceAdminControllerAcceptInvitation({ code });
      await switchWorkspaceAndReload(joined.workspaceId);
    } catch (err) {
      setError(readApiError(err, 'Could not accept the invitation.'));
      setBusy(false);
    }
  };

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await WorkspacesService.workspaceAdminControllerAcceptInvitationWithNewAccount({ code, displayName, slug, password });
      await login(preview.email, password);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(readApiError(err, 'Could not create the account.'));
      setBusy(false);
    }
  };

  const signInToAccept = () =>
    navigate('/login', { state: { from: { pathname: '/invite', search: location.search } } });

  const role = preview?.role === WorkspaceRole.ADMIN ? 'an admin' : 'a member';
  const signedInAs = user?.email;
  const isInvitedAccount = signedInAs?.toLowerCase() === preview?.email.toLowerCase();

  return (
    <LoginShell>
      <Stack spacing="6">
        <Stack spacing="2" align="center">
          <Text size="6" weight="bold" className="login__copy">
            {preview ? `Join ${preview.workspaceName}` : 'Workspace invitation'}
          </Text>
          {preview ? (
            <Text tone="muted" className="login__copy">
              {preview.email} is invited as {role} of @{preview.workspaceSlug}.
            </Text>
          ) : null}
        </Stack>

        {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}

        {!preview || authLoading ? null : isAuthenticated ? (
          isInvitedAccount ? (
            <Button variant="primary" size="lg" className="login-button" disabled={busy} onClick={() => void accept()}>
              {busy ? 'Joining...' : `Join ${preview.workspaceName}`}
            </Button>
          ) : (
            <Stack spacing="3">
              <Text size="2" tone="muted">
                You're signed in as {signedInAs ?? 'another account'}. This invitation is for {preview.email}: sign out, then open the link again.
              </Text>
              <Link to="/logout">Sign out</Link>
            </Stack>
          )
        ) : preview.accountExists ? (
          <Button variant="primary" size="lg" className="login-button" onClick={signInToAccept}>
            Sign in as {preview.email} to join
          </Button>
        ) : (
          <form onSubmit={createAccount}>
            <Stack spacing="4">
              <Text size="2" tone="muted">Create your account to join.</Text>
              <Stack spacing="2">
                <label htmlFor="invite-display-name" className="login-label"><Text size="2" weight="medium">Display name</Text></label>
                <input id="invite-display-name" className="login-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane User" required disabled={busy} autoComplete="name" />
              </Stack>
              <Stack spacing="2">
                <label htmlFor="invite-slug" className="login-label"><Text size="2" weight="medium">Username</Text></label>
                <input id="invite-slug" className="login-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="jane" required disabled={busy} autoComplete="username" />
              </Stack>
              <Stack spacing="2">
                <label htmlFor="invite-password" className="login-label"><Text size="2" weight="medium">Password</Text></label>
                <input id="invite-password" type="password" className="login-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} disabled={busy} autoComplete="new-password" />
              </Stack>
              <Button type="submit" variant="primary" size="lg" className="login-button" disabled={busy}>
                {busy ? 'Creating account...' : `Create account and join`}
              </Button>
            </Stack>
          </form>
        )}
      </Stack>
    </LoginShell>
  );
}
