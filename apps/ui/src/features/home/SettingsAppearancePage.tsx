import { Stack, Text } from '../../ui/primitives';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useHomeCtx } from './HomeProvider';
import { useEffect } from 'react';
import { SettingsThemeVisual } from './SettingsThemeVisual';
import { SETTINGS_THEME_OPTIONS } from './settingsThemes';
import './SettingsPage.css';

export function SettingsAppearancePage() {
  const { theme, setTheme } = useTheme();
  const { setSectionTitle } = useHomeCtx();

  useEffect(() => {
    setSectionTitle('Appearance');
  }, []);

  return (
    <Stack spacing="6" className="settings-subpage settings-subpage--wide">
      <Text tone="muted" className="settings-subpage__intro">
        Choose the visual style used across Taico.
      </Text>

      <div className="settings-theme-grid" aria-label="Theme choices">
        {SETTINGS_THEME_OPTIONS.map((themeOption) => {
          const isActive = theme === themeOption.value;

          return (
            <button
              key={themeOption.value}
              type="button"
              className={`settings-theme-card ${isActive ? 'settings-theme-card--active' : ''}`}
              onClick={() => setTheme(themeOption.value)}
              aria-pressed={isActive}
            >
              <SettingsThemeVisual preview={themeOption.preview} size="large" />
              <span className="settings-theme-card__body">
                <span className="settings-theme-card__header">
                  <span className="settings-theme-card__title">{themeOption.label}</span>
                  <span className="settings-theme-card__badge">{isActive ? 'Active' : themeOption.preview.font}</span>
                </span>
                <span className="settings-theme-card__description">{themeOption.description}</span>
                <span className="settings-theme-card__palette" aria-hidden="true">
                  <span style={{ backgroundColor: themeOption.preview.background }} />
                  <span style={{ backgroundColor: themeOption.preview.surface }} />
                  <span style={{ backgroundColor: themeOption.preview.card }} />
                  <span style={{ backgroundColor: themeOption.preview.accent }} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Stack>
  );
}
