import type { Theme } from '../../app/providers/ThemeProvider';

export type SettingsThemePreview = {
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  font: string;
};

export type SettingsThemeOption = {
  value: Theme;
  label: string;
  description: string;
  preview: SettingsThemePreview;
};

export const SETTINGS_THEME_OPTIONS: SettingsThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Clean light theme with a crisp blue accent.',
    preview: {
      background: '#ffffff',
      surface: '#f6f8fa',
      card: '#ffffff',
      border: '#d1d9e0',
      text: '#1f2328',
      muted: '#59636e',
      accent: '#0969da',
      accentSoft: '#ddf4ff',
      font: 'Inter',
    },
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-light surfaces with GitHub-style blue highlights.',
    preview: {
      background: '#0d1117',
      surface: '#161b22',
      card: '#0d1117',
      border: '#30363d',
      text: '#e6edf3',
      muted: '#8b949e',
      accent: '#2f81f7',
      accentSoft: '#1f6feb33',
      font: 'Inter',
    },
  },
  {
    value: 'clarity',
    label: 'Clarity',
    description: 'Soft neutral surfaces for focused daytime work.',
    preview: {
      background: '#f7f7f5',
      surface: '#f2f4f7',
      card: '#ffffff',
      border: '#d9dee5',
      text: '#1f2328',
      muted: '#66707a',
      accent: '#3971d9',
      accentSoft: '#e5efff',
      font: 'Inter',
    },
  },
  {
    value: 'github',
    label: 'GitHub',
    description: 'GitHub-inspired neutrals with a green action color.',
    preview: {
      background: '#ffffff',
      surface: '#f6f8fa',
      card: '#ffffff',
      border: '#d0d7de',
      text: '#24292f',
      muted: '#57606a',
      accent: '#1f883d',
      accentSoft: '#dafbe1',
      font: 'Inter',
    },
  },
  {
    value: 'forest',
    label: 'Forest',
    description: 'Dark green workspace with softer natural contrast.',
    preview: {
      background: '#0f1a0f',
      surface: '#152615',
      card: '#102010',
      border: '#2d4a2d',
      text: '#e8f5e8',
      muted: '#9bb89b',
      accent: '#52c952',
      accentSoft: '#1f4d2a',
      font: 'Inter',
    },
  },
  {
    value: 'terminal',
    label: 'Terminal',
    description: 'Classic terminal green on a black interface.',
    preview: {
      background: '#000000',
      surface: '#0a0a0a',
      card: '#050505',
      border: '#00aa00',
      text: '#00ff00',
      muted: '#00aa00',
      accent: '#00dd00',
      accentSoft: '#003b00',
      font: 'Mono',
    },
  },
  {
    value: 'ai-vibes',
    label: 'AI Vibes',
    description: 'Deep purples with neon-like accents.',
    preview: {
      background: '#0c0716',
      surface: '#1a102b',
      card: '#130b21',
      border: '#3b255f',
      text: '#f5efff',
      muted: '#c4b5db',
      accent: '#a855f7',
      accentSoft: '#3b1762',
      font: 'Inter',
    },
  },
  {
    value: 'halo',
    label: 'Halo',
    description: 'Light background with cooler layered surfaces.',
    preview: {
      background: '#f9f9fc',
      surface: '#eef1f9',
      card: '#ffffff',
      border: '#d8deef',
      text: '#1f2937',
      muted: '#667085',
      accent: '#3b5bcc',
      accentSoft: '#e6ebff',
      font: 'Inter',
    },
  },
  {
    value: 'mono',
    label: 'Mono',
    description: 'Black and white minimalism with restrained contrast.',
    preview: {
      background: '#ffffff',
      surface: '#f5f5f5',
      card: '#ffffff',
      border: '#d4d4d4',
      text: '#111111',
      muted: '#666666',
      accent: '#111111',
      accentSoft: '#eeeeee',
      font: 'Inter',
    },
  },
  {
    value: 'terminal-amber',
    label: 'Terminal Amber',
    description: 'Warm terminal tones with a calm blue accent.',
    preview: {
      background: '#0b0a09',
      surface: '#17130d',
      card: '#120f0b',
      border: '#3a2d16',
      text: '#f5d78e',
      muted: '#b9975b',
      accent: '#8ab4f8',
      accentSoft: '#1d2740',
      font: 'Mono',
    },
  },
  {
    value: 'oceanic',
    label: 'Oceanic',
    description: 'Cool blues and teals for a calmer dark theme.',
    preview: {
      background: '#0c1b2a',
      surface: '#102a3d',
      card: '#0f2233',
      border: '#1d4a5f',
      text: '#e6fffb',
      muted: '#9bd5d0',
      accent: '#4fd1c5',
      accentSoft: '#123c47',
      font: 'Inter',
    },
  },
  {
    value: 'party',
    label: 'Party',
    description: 'Playful warm palette with saturated highlights.',
    preview: {
      background: '#fff7f0',
      surface: '#fff0e0',
      card: '#ffffff',
      border: '#ffd4d4',
      text: '#2d1b1b',
      muted: '#7a5a5a',
      accent: '#ff6b6b',
      accentSoft: '#ffe3df',
      font: 'Inter',
    },
  },
  {
    value: 'tribute',
    label: 'Tribute',
    description: 'Dark sidebar energy inspired by the previous UI.',
    preview: {
      background: '#0b1220',
      surface: '#111827',
      card: '#0f172a',
      border: '#1e293b',
      text: '#e5e7eb',
      muted: '#94a3b8',
      accent: '#2563eb',
      accentSoft: '#172554',
      font: 'Inter',
    },
  },
];
