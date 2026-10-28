import { GithubAuthType } from '../../enums';

export type CreateGithubConnectionInput = {
  name: string;
  /** The GitHub to talk to. Missing: github.com. */
  baseUrl?: string | null;
  authType: GithubAuthType;
  /** The token (PAT) or the PEM private key (App). */
  secret: string;
  appId?: string | null;
  installationId?: string | null;
  /** Empty or missing: the account the credential acts as. */
  owners?: string[];
  createdByActorId: string;
};

export type UpdateGithubConnectionInput = {
  name?: string;
  baseUrl?: string;
  /** A new token or private key. Undefined keeps the current one. */
  secret?: string;
  appId?: string | null;
  installationId?: string | null;
  owners?: string[];
};

export type GithubConnectionResult = {
  id: string;
  name: string;
  /** `https://github.com`, or the address of a GitHub Enterprise. */
  baseUrl: string;
  /** The host of baseUrl: `github.com`, `github.acme.com`. */
  host: string;
  authType: GithubAuthType;
  appId: string | null;
  installationId: string | null;
  owners: string[];
  accountLogin: string | null;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  lastWebhookAt: Date | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Why a repository uses the connection it does. */
export type GithubConnectionMatch = 'project' | 'owner' | 'only_connection';

export type ResolvedGithubConnection = {
  connection: GithubConnectionResult;
  match: GithubConnectionMatch;
};

/** A repository, or a whole owner, a connection receives webhooks for. */
export type GithubWebhookSource = {
  owner: string;
  /** Null: every repository of the owner (an organization or GitHub App webhook). */
  repo: string | null;
  lastDeliveryAt: Date;
  /** The last delivery's event: `ping` right after the webhook is set up. */
  lastEvent: string | null;
  /** Delivered recently enough that Taico counts on the webhook and polls less. */
  active: boolean;
};

export type GithubWebhookSettings = {
  /** Where GitHub should send deliveries. */
  url: string;
  /** The secret to paste into GitHub. */
  secret: string;
  lastDeliveryAt: Date | null;
  /** Where deliveries came from, most recent first. */
  sources: GithubWebhookSource[];
};

/** A delivery as GitHub sent it: what the webhook covers is read from it. */
export type GithubWebhookDelivery = {
  rawBody: Buffer;
  signature: string | undefined;
  /** X-GitHub-Event */
  event: string | undefined;
  /** X-GitHub-Hook-Installation-Target-Type: repository, organization or integration. */
  targetType: string | undefined;
  body: unknown;
};
