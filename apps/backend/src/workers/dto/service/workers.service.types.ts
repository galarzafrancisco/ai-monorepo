import { AgentType } from 'src/agents/enums';
import type { WorkerCapabilities } from '@taico/events';

export type RecordWorkerSeenInput = {
  oauthClientId: string;
  seenAt?: Date;
  workerVersion?: string | null;
  harnesses?: AgentType[];
  capabilities?: WorkerCapabilities;
};

export type WorkerResult = {
  id: string;
  oauthClientId: string;
  workerVersion: string | null;
  lastSeenAt: Date;
  harnesses: AgentType[];
  capabilities: WorkerCapabilities | null;
  createdAt: Date;
  updatedAt: Date;
};
