import type { AgentResponseDto, AgentToolPermissionResponseDto } from "@taico/client/v2";
import type { ChipProps } from "../../ui/primitives";
import { TASKS_STATUS, type TaskStatus } from "../../shared/const/taskStatus";
import type { AgentToken } from "./types";

type AgentType = AgentResponseDto['type'];

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  claude: 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
  adk: 'ADK',
  githubcopilot: 'GitHub Copilot',
  other: 'Other',
};

export const AGENT_TYPE_COLORS: Record<AgentType, NonNullable<ChipProps['color']>> = {
  claude: 'orange',
  codex: 'green',
  opencode: 'blue',
  adk: 'red',
  githubcopilot: 'yellow',
  other: 'gray',
};

export function agentTypeLabel(type: AgentType): string {
  return AGENT_TYPE_LABELS[type] ?? type;
}

/** "Queued, Review" — status triggers in the words the tasks board uses. */
export function statusTriggersLabel(statusTriggers: string[]): string {
  if (statusTriggers.length === 0) return 'None';
  return statusTriggers
    .map((status) => TASKS_STATUS[status as TaskStatus]?.label ?? status)
    .join(', ');
}

export function concurrencyLimitOf(agent: AgentResponseDto): number | null {
  const value = agent.concurrencyLimit as unknown;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

export type TokenState = 'active' | 'expiring' | 'expired' | 'revoked';

const DAY_MS = 24 * 60 * 60 * 1000;

export function tokenState(token: AgentToken, now = Date.now()): TokenState {
  if (token.revokedAt) return 'revoked';
  const expiresAt = new Date(token.expiresAt).getTime();
  if (!token.isValid || expiresAt <= now) return 'expired';
  if (expiresAt - now < 7 * DAY_MS) return 'expiring';
  return 'active';
}

export function isTokenActive(token: AgentToken): boolean {
  const state = tokenState(token);
  return state === 'active' || state === 'expiring';
}

/** "in 3 days", "2 hours ago", "today" — short relative time for token dates. */
export function relativeTime(dateString: string, now = Date.now()): string {
  const diff = new Date(dateString).getTime() - now;
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * DAY_MS],
    ['month', 30 * DAY_MS],
    ['day', DAY_MS],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ];
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (abs >= ms) return format.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

/** One short line describing a token's lifecycle, e.g. "Expires in 30 days". */
export function tokenSummary(token: AgentToken): string {
  switch (tokenState(token)) {
    case 'revoked':
      return `Revoked ${relativeTime(String(token.revokedAt))}`;
    case 'expired':
      return `Expired ${relativeTime(token.expiresAt)}`;
    default:
      return `Expires ${relativeTime(token.expiresAt)}`;
  }
}

export function lastUsedLabel(token: AgentToken): string {
  return token.lastUsedAt ? `Used ${relativeTime(token.lastUsedAt)}` : 'Never used';
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "anthropic/claude-opus-4", or null when the agent runs on its defaults. */
export function modelSummary(agent: AgentResponseDto): string | null {
  const parts = [agent.providerId?.trim(), agent.modelId?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join('/') : null;
}

/** Tasks and Context are built in: every agent has them. */
export function isSystemTool(permission: AgentToolPermissionResponseDto): boolean {
  return permission.server.providedId === 'tasks' || permission.server.providedId === 'context';
}

export function toolScopeSummary(permission: AgentToolPermissionResponseDto): string {
  if (permission.server.type === 'stdio') return 'No scopes';
  if (permission.hasAllScopes) return 'All scopes';
  const count = permission.grantedScopes.length;
  return `${count} scope${count === 1 ? '' : 's'}`;
}
