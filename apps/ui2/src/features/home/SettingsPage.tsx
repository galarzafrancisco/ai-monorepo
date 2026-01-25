import { Stack, Text, Card, Row, Button } from '../../ui/primitives';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { useAuth } from '../../auth/AuthContext';
import { WebAuthenticationService } from '../../auth/api';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useNavigate } from 'react-router-dom';
import './SettingsPage.css';

const THEMES = [
  { value: 'light', label: 'Light', description: 'Clean light theme' },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
  { value: 'github', label: 'GitHub', description: 'GitHub-inspired green accent' },
  { value: 'forest', label: 'Forest', description: 'Nature-inspired dark green' },
  { value: 'terminal', label: 'Terminal', description: 'Classic terminal green on black' },
  { value: 'ai-vibes', label: 'AI Vibes', description: 'Deep purples with neon accents' },
  { value: 'halo', label: 'Halo', description: 'Light background with deeper surfaces' },
  { value: 'mono', label: 'Mono', description: 'Black and white minimalism' },
  { value: 'terminal-amber', label: 'Terminal Amber', description: 'Terminal tones without the green' },
  { value: 'oceanic', label: 'Oceanic', description: 'Cool blues and teals' },
] as const;

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { setSectionTitle } = useHomeCtx();
  const { logout } = useAuth();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSectionTitle('Settings');
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

      // Log out the user after 2 seconds
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
      {isDesktop ?
        <Text tone="muted">Customize your experience</Text>
        : ''}

      <Card padding="5">
        <Stack spacing="4">
          <Stack spacing="2">
            <Text size="4" weight="semibold">Security</Text>
            <Text tone="muted">Change your password</Text>
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
                  minLength={8}
                />
                <Text size="1" tone="muted">Minimum 8 characters</Text>
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

      <Card padding="5">
        <Stack spacing="4">
          <Stack spacing="2">
            <Text size="4" weight="semibold">Appearance</Text>
            <Text tone="muted">Choose your preferred color theme</Text>
          </Stack>

          <Stack spacing="3">
            {THEMES.map((themeOption) => {
              const isActive = theme === themeOption.value;

              return (
                <Card
                  key={themeOption.value}
                  padding="4"
                  className={isActive ? 'settings-theme-card--active' : ''}
                >
                  <Row justify="space-between" align="center">
                    <Stack spacing="1">
                      <Text weight="semibold">{themeOption.label}</Text>
                      <Text size="1" tone="muted">{themeOption.description}</Text>
                    </Stack>
                    <Button
                      variant={isActive ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setTheme(themeOption.value as any)}
                    >
                      {isActive ? 'Active' : 'Select'}
                    </Button>
                  </Row>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
