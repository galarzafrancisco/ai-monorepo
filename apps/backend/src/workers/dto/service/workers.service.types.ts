import { AgentType } from 'src/agents/enums';

export type RecordWorkerSeenInput = {
  oauthClientId: string;
  seenAt?: Date;
  harnesses?: AgentType[];
};
