import { IssueReferenceSource } from '../../enums';
import { IssueRef } from '../../github/issue-ref';

export type IssueReferenceInput = {
  sourceType: IssueReferenceSource;
  sourceId: string;
  refs: IssueRef[];
  taskId?: string | null;
  threadId?: string | null;
};
