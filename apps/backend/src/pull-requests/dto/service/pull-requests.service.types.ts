import { PullRequestReferenceSource } from '../../enums';
import { PullRequestRef } from '../../github/pull-request-ref';

export type PullRequestReferenceInput = {
  sourceType: PullRequestReferenceSource;
  sourceId: string;
  refs: PullRequestRef[];
  taskId?: string | null;
  threadId?: string | null;
};
