import { Stack, Text, Card, Button } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette } from '../../ui/components';
import { ChatProvidersService, MetaService } from '@taico/client';
import { useTheme } from '../../app/providers/ThemeProvider';
import type { Theme } from '../../app/providers/ThemeProvider';
import { ProjectsService } from '../projects/api';
import { useWorkers } from '../workers/useWorkers';
import { SettingsThemeVisual } from './SettingsThemeVisual';
import { SETTINGS_THEME_OPTIONS } from './settingsThemes';
import {
  Bot,
  Box,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Palette,
  Server,
  Sparkles,
} from 'lucide-react';
import './SettingsPage.css';

type SettingsMetric = {
  projects: number | null;
  providers: {
    configured: number;
    total: number;
    activeName: string | null;
  } | null;
};

export function SettingsPage() {
  const { setSectionTitle } = useHomeCtx();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { registerCommands } = useCommandPalette();
  const { theme, setTheme } = useTheme();
  const { workers, isLoading: areWorkersLoading } = useWorkers();
  const [version, setVersion] = useState<{ backend: string; ui: string } | null>(null);
  const [metrics, setMetrics] = useState<SettingsMetric>({
    projects: null,
    providers: null,
  });

  // Set document title (browser tab)
  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Settings');
    loadVersion();
    loadMetrics();
  }, []);

  const loadVersion = async () => {
    try {
      const versionData = await MetaService.metaControllerGetVersion();
      setVersion(versionData);
    } catch (error) {
      console.error('Failed to load version:', error);
    }
  };

  const loadMetrics = async () => {
    const [projectsResult, providersResult] = await Promise.allSettled([
      ProjectsService.projectsControllerGetAllProjects(),
      ChatProvidersService.chatProvidersControllerListChatProviders(),
    ]);

    setMetrics({
      projects: projectsResult.status === 'fulfilled' ? projectsResult.value.length : null,
      providers: providersResult.status === 'fulfilled'
        ? {
            configured: providersResult.value.filter((provider) => provider.isConfigured).length,
            total: providersResult.value.length,
            activeName: providersResult.value.find((provider) => provider.isActive)?.name ?? null,
          }
        : null,
    });
  };

  // Register page-specific commands
  useEffect(() => {
    const commands = [
      {
        id: 'settings-account',
        label: 'Account Settings',
        description: 'Manage your account security',
        aliases: ['password', 'account', 'security'],
        onSelect: () => navigate('/settings/account'),
      },
      {
        id: 'settings-appearance',
        label: 'Appearance Settings',
        description: 'Choose your preferred color theme',
        aliases: ['theme', 'appearance', 'dark mode', 'light mode'],
        onSelect: () => navigate('/settings/appearance'),
      },
      {
        id: 'settings-projects',
        label: 'Projects Settings',
        description: 'Manage your projects',
        aliases: ['projects', 'manage projects'],
        onSelect: () => navigate('/settings/projects'),
      },
      {
        id: 'settings-chat',
        label: 'Chat Settings',
        description: 'Configure chat providers for conversations',
        aliases: ['chat', 'openai', 'providers', 'chat providers'],
        onSelect: () => navigate('/settings/chat'),
      },
      {
        id: 'settings-workers',
        label: 'Workers Settings',
        description: 'Configure and manage background workers',
        aliases: ['workers', 'background', 'execution'],
        onSelect: () => navigate('/settings/workers'),
      },
      {
        id: 'settings-ai-providers',
        label: 'AI Providers',
        description: 'View usage and quota for AI providers',
        aliases: ['ai', 'providers', 'usage', 'quota', 'anthropic', 'openai', 'claude'],
        onSelect: () => navigate('/settings/ai-providers'),
      },
      {
        id: 'settings-data',
        label: 'Import / Export',
        description: 'Import and export workspace data',
        aliases: ['data', 'export', 'import', 'backup', 'restore'],
        onSelect: () => navigate('/settings/data'),
      },
    ];

    return registerCommands(commands);
  }, [registerCommands, navigate]);

  const connectedWorkers = workers.filter((worker) => {
    const lastSeen = new Date(worker.lastSeenAt);
    const diffMs = Date.now() - lastSeen.getTime();
    return diffMs <= 2 * 60 * 1000;
  }).length;

  const settingGroups = [
    {
      title: 'Appearance',
      description: 'Theme and visual preferences for Taico.',
      icon: Palette,
      iconTone: 'accent',
      path: '/settings/appearance',
      action: 'More themes',
      detail: { label: 'Current theme', value: themeLabel(theme), tone: 'default' },
      preview: (
        <ThemePreviewCarousel
          activeTheme={theme}
          onSelect={(nextTheme) => setTheme(nextTheme)}
        />
      ),
    },
    {
      title: 'Projects',
      description: 'Project metadata and repository links.',
      icon: FolderKanban,
      iconTone: 'accent',
      path: '/settings/projects',
      action: 'Manage',
      detail: { label: 'Projects', value: metrics.projects === null ? 'Unavailable' : String(metrics.projects), tone: 'default' },
    },
    {
      title: 'AI & Chat',
      description: 'Conversation providers and active chat routing.',
      icon: Sparkles,
      iconTone: 'warning',
      path: '/settings/chat',
      action: 'Configure',
      detail: {
        label: 'Active provider',
        value: metrics.providers?.activeName ?? 'Not selected',
        tone: metrics.providers?.activeName ? 'default' : 'muted',
      },
    },
    {
      title: 'Workers',
      description: 'Background execution workers and harness health.',
      icon: Server,
      iconTone: 'green',
      path: '/settings/workers',
      action: 'Open workers',
      detail: { label: 'Connected workers', value: areWorkersLoading ? 'Loading' : String(connectedWorkers), tone: 'default' },
    },
    {
      title: 'Account',
      description: 'Password and account-level access controls.',
      icon: LockKeyhole,
      iconTone: 'red',
      path: '/settings/account',
      action: 'Security',
      detail: { label: 'Password', value: 'Change available', tone: 'default' },
    },
    {
      title: 'Data',
      description: 'Import and export workspace context blocks.',
      icon: Database,
      iconTone: 'neutral',
      path: '/settings/data',
      action: 'Import / export',
      detail: { label: 'Export', value: 'Context blocks', tone: 'default' },
    },
  ];

  return (
    <div className="settings-page">
      {isDesktop ? (
        <Text tone="muted">Manage your workspace, execution, providers, and data.</Text>
      ) : null}

      <div className="settings-page__layout">
        <main className="settings-page__main" aria-label="Settings sections">
          <div className="settings-page__nav" aria-label="Settings shortcuts">
            <button
              className="settings-page__nav-item"
              type="button"
              onClick={() => navigate('/settings')}
              aria-current="page"
            >
              <LayoutDashboard size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Overview</span>
            </button>
            {settingGroups.slice(0, 4).map((group) => {
              const Icon = group.icon;
              return (
                <button
                  key={group.title}
                  className="settings-page__nav-item"
                  type="button"
                  onClick={() => navigate(group.path)}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>{group.title}</span>
                </button>
              );
            })}
          </div>

          <div className="settings-page__section-grid">
            {settingGroups.map((group) => {
              const Icon = group.icon;
              return (
                <Card
                  key={group.title}
                  padding="0"
                  className={`settings-page__section-card ${group.preview ? 'settings-page__section-card--with-carousel' : ''}`}
                >
                  <div className="settings-page__section-header">
                    <span className={`settings-page__section-icon settings-page__section-icon--${group.iconTone}`}>
                      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <Stack spacing="1">
                      <Text size="3" weight="semibold">{group.title}</Text>
                      <Text size="1" tone="muted">{group.description}</Text>
                    </Stack>
                  </div>

                  {group.preview ?? (
                    <div className="settings-page__detail">
                      <Text size="1" tone="muted">{group.detail.label}</Text>
                      <Text size="2" weight="medium" tone={group.detail.tone as 'default' | 'muted'}>
                        {group.detail.value}
                      </Text>
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => navigate(group.path)}
                    className="settings-page__section-action"
                  >
                    <span>{group.action}</span>
                    <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </main>

        <aside className="settings-page__side" aria-label="Settings status">
          <Card padding="4" className="settings-page__side-card">
            <Stack spacing="4">
              <Text size="3" weight="semibold">Readiness</Text>
              <StatusRow
                icon={<CheckCircle2 size={16} strokeWidth={1.8} />}
                label="Chat provider"
                value={metrics.providers?.activeName ?? 'Needs active provider'}
                isReady={Boolean(metrics.providers?.activeName)}
              />
              <StatusRow
                icon={<Server size={16} strokeWidth={1.8} />}
                label="Worker connection"
                value={areWorkersLoading ? 'Checking' : connectedWorkers > 0 ? `${connectedWorkers} online` : 'No workers online'}
                isReady={connectedWorkers > 0}
              />
              <StatusRow
                icon={<FolderKanban size={16} strokeWidth={1.8} />}
                label="Projects"
                value={metrics.projects === null ? 'Checking' : `${metrics.projects} available`}
                isReady={(metrics.projects ?? 0) > 0}
              />
            </Stack>
          </Card>

          <Card padding="4" className="settings-page__side-card">
            <Stack spacing="3">
              <Text size="3" weight="semibold">Quick links</Text>
              <QuickLink icon={<Bot size={16} />} label="AI usage" onClick={() => navigate('/settings/ai-providers')} />
              <QuickLink icon={<KeyRound size={16} />} label="Chat API keys" onClick={() => navigate('/settings/chat')} />
              <QuickLink icon={<Box size={16} />} label="Setup walkthrough" onClick={() => navigate('/walkthrough')} />
              <QuickLink icon={<ExternalLink size={16} />} label="Tools" onClick={() => navigate('/tools')} />
            </Stack>
          </Card>

          {version ? (
            <Text size="1" tone="muted" className="settings-page__version">
              Taico v{version.backend} · UI v{version.ui}
            </Text>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function themeLabel(theme: string) {
  return theme
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ThemePreviewCarousel({
  activeTheme,
  onSelect,
}: {
  activeTheme: Theme;
  onSelect: (theme: Theme) => void;
}) {
  return (
    <div className="settings-page__theme-carousel" aria-label="Theme preview selector">
      {SETTINGS_THEME_OPTIONS.map((themeOption) => {
        const isActive = activeTheme === themeOption.value;

        return (
          <button
            key={themeOption.value}
            type="button"
            className={`settings-page__theme-preview ${isActive ? 'settings-page__theme-preview--active' : ''}`}
            onClick={() => onSelect(themeOption.value)}
            aria-pressed={isActive}
          >
            <SettingsThemeVisual preview={themeOption.preview} />
            <span className="settings-page__theme-preview-copy">
              <span>{themeOption.label}</span>
              <span>{themeOption.preview.font}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  isReady,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  isReady: boolean;
}) {
  return (
    <div className="settings-page__status-row">
      <span className={`settings-page__status-icon ${isReady ? 'settings-page__status-icon--ready' : ''}`}>
        {icon}
      </span>
      <div>
        <Text size="2" weight="medium">{label}</Text>
        <Text size="1" tone="muted">{value}</Text>
      </div>
    </div>
  );
}

function QuickLink({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="settings-page__quick-link" type="button" onClick={onClick}>
      <span className="settings-page__quick-link-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <ChevronRight size={15} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
