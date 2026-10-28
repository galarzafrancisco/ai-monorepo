import { GithubAuthType } from '../../enums';

export type CreateGithubConnectionInput = {
  name: string;
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
  /** A new token or private key. Undefined keeps the current one. */
  secret?: string;
  appId?: string | null;
  installationId?: string | null;
  owners?: string[];
};

export type GithubConnectionResult = {
  id: string;
  name: string;
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

export type GithubWebhookSettings = {
  /** Where GitHub should send deliveries. */
  url: string;
  /** The secret to paste into GitHub. */
  secret: string;
  lastDeliveryAt: Date | null;
};
