import { relativeTime } from '../../features/agents/agentDisplay';

/** A repository or whole owner a connection receives webhooks for, as the API returns it. */
export type GithubWebhookSourceView = {
  owner: string;
  repo: string | null;
  lastDeliveryAt: string;
  lastEvent: string | null;
  active: boolean;
};

/** "acme/api", or "all of acme" for an organization or GitHub App webhook. */
export function webhookSourceLabel(source: Pick<GithubWebhookSourceView, 'owner' | 'repo'>): string {
  return source.repo ? `${source.owner}/${source.repo}` : `all of ${source.owner}`;
}

/** "last delivery 3 minutes ago", "set up 2 hours ago, nothing else yet" for a webhook that only pinged. */
export function webhookDeliveryLabel(source: GithubWebhookSourceView, now = Date.now()): string {
  const when = relativeTime(source.lastDeliveryAt, now);
  if (!source.active) return `quiet since ${when}: polled as if there were no webhook`;
  return source.lastEvent === 'ping' ? `set up ${when}, nothing else yet` : `last delivery ${when}`;
}
