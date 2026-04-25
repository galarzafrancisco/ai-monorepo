import { AgentType } from 'src/agents/enums';

export type RecordWorkerSeenInput = {
  oauthClientId: string;
  seenAt?: Date;
  harnesses?: AgentType[];
};

export type WorkerResult = {
  id: string;
  oauthClientId: string;
  lastSeenAt: Date;
  harnesses: AgentType[];
  createdAt: Date;
  updatedAt: Date;
};
