import type { CSSProperties } from 'react';
import type { SettingsThemePreview } from './settingsThemes';

type SettingsThemeVisualProps = {
  preview: SettingsThemePreview;
  size?: 'compact' | 'large';
};

export function SettingsThemeVisual({ preview, size = 'compact' }: SettingsThemeVisualProps) {
  const style = {
    '--theme-preview-bg': preview.background,
    '--theme-preview-surface': preview.surface,
    '--theme-preview-card': preview.card,
    '--theme-preview-border': preview.border,
    '--theme-preview-text': preview.text,
    '--theme-preview-muted': preview.muted,
    '--theme-preview-accent': preview.accent,
    '--theme-preview-accent-soft': preview.accentSoft,
  } as CSSProperties;

  return (
    <span
      className={`settings-theme-visual settings-theme-visual--${size}`}
      style={style}
      aria-hidden="true"
    >
      <span className="settings-theme-visual__window">
        <span className="settings-theme-visual__rail">
          <span className="settings-theme-visual__accent-dot" />
          <span className="settings-theme-visual__rail-line" />
          <span className="settings-theme-visual__rail-line settings-theme-visual__rail-line--short" />
        </span>
        <span className="settings-theme-visual__canvas">
          <span className="settings-theme-visual__font">{preview.font === 'Mono' ? 'Aa' : 'Ag'}</span>
          <span className="settings-theme-visual__line settings-theme-visual__line--wide" />
          <span className="settings-theme-visual__panel">
            <span className="settings-theme-visual__chip" />
            <span className="settings-theme-visual__line" />
            <span className="settings-theme-visual__line settings-theme-visual__line--short" />
          </span>
          <span className="settings-theme-visual__button" />
        </span>
      </span>
    </span>
  );
}
