import { Stack, Text, Card, Row, Button } from '../../ui/primitives';
import { useTheme } from '../providers';
import './SettingsPage.css';

const THEMES = [
  { value: 'light', label: 'Light', description: 'Clean light theme' },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
  { value: 'github', label: 'GitHub', description: 'GitHub-inspired green accent' },
  { value: 'forest', label: 'Forest', description: 'Nature-inspired dark green' },
  { value: 'terminal', label: 'Terminal', description: 'Classic terminal green on black' },
] as const;

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <Stack spacing="6">
      <Stack spacing="2">
        <Text size="6" weight="bold">Settings</Text>
        <Text tone="muted">Customize your experience</Text>
      </Stack>

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
