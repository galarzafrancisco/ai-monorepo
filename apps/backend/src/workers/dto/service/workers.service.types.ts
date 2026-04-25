import { AgentType } from 'src/agents/enums';

export type RecordWorkerSeenInput = {
  oauthClientId: string;
  seenAt?: Date;
  workerVersion?: string | null;
  harnesses?: AgentType[];
};

export type WorkerResult = {
  id: string;
  oauthClientId: string;
  workerVersion: string | null;
  lastSeenAt: Date;
  harnesses: AgentType[];
  createdAt: Date;
  updatedAt: Date;
};
