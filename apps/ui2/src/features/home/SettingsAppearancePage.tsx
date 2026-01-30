import { Stack, Text, Card, Row, Button } from '../../ui/primitives';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useHomeCtx } from './HomeProvider';
import { useEffect } from 'react';
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
  { value: 'party', label: 'Party', description: 'Playful warm palette' },
  { value: 'tribute', label: 'Tribute', description: 'Inspired by the old UI\'s dark sidebar' },
] as const;

export function SettingsAppearancePage() {
  const { theme, setTheme } = useTheme();
  const { setSectionTitle } = useHomeCtx();

  useEffect(() => {
    setSectionTitle('Appearance');
  }, []);

  return (
    <Stack spacing="6">
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
