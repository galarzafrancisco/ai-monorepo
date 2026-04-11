import { Stack, Text, Card, Button } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { WebAuthenticationService } from '../../auth/api';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useNavigate } from 'react-router-dom';
import '../../auth/LoginPage.css';

export function SettingsAccountPage() {
  const { setSectionTitle } = useHomeCtx();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSectionTitle('Account');
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await WebAuthenticationService.webAuthControllerChangePassword({
        currentPassword,
        newPassword,
      });

      setSuccess('Password changed successfully! You will be logged out.');
      setCurrentPassword('');
      setNewPassword('');

      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to change password. Please check your current password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack spacing="6">
      <Card padding="5">
        <Stack spacing="4">
          <Stack spacing="2">
            <Text size="4" weight="semibold">Change Password</Text>
            <Text tone="muted">Update your account password</Text>
          </Stack>

          <form onSubmit={handleChangePassword}>
            <Stack spacing="4">
              <Stack spacing="2">
                <label htmlFor="current-password" className="login-label">
                  <Text size="2" weight="medium">Current Password</Text>
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="login-input"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </Stack>

              <Stack spacing="2">
                <label htmlFor="new-password" className="login-label">
                  <Text size="2" weight="medium">New Password</Text>
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="login-input"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </Stack>

              {error && (
                <ErrorText size="2" weight="medium">
                  {error}
                </ErrorText>
              )}

              {success && (
                <div style={{ color: 'var(--accent)' }}>
                  <Text size="2" weight="medium">
                    {success}
                  </Text>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isLoading || !currentPassword || !newPassword}
              >
                {isLoading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Stack>
  );
}
