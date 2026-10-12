import { SearchMatchField, SearchStrategy } from '../../../search/enums';

export interface CreateBlockInput {
  title: string;
  content: string;
  createdByActorId: string;
  tagNames?: string[];
  parentId?: string | null;
}

export interface UpdateBlockInput {
  title?: string;
  content?: string;
  tagNames?: string[];
  parentId?: string | null;
  order?: number;
  actorId?: string;
}

export interface AppendBlockInput {
  content: string;
  actorId?: string;
}

export interface ListBlocksInput {
  tag?: string;
  createdByActorId?: string;
  parentId?: string | null;
  updatedAfter?: Date;
  limit?: number;
}

export interface TagResult {
  id: string;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddTagInput {
  name: string;
}

export interface BlockResult {
  id: string;
  title: string;
  content: string;
  createdByActorId: string;
  createdBy: string | null;
  assigneeActorId?: string | null;
  assignee?: string | null;
  tags: TagResult[];
  parentId: string | null;
  order: number;
  children?: BlockResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockSummaryResult {
  id: string;
  title: string;
  createdByActorId: string;
  createdBy: string | null;
  tags: TagResult[];
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockTreeResult {
  id: string;
  title: string;
  createdByActorId: string;
  createdBy: string | null;
  parentId: string | null;
  order: number;
  children: BlockTreeResult[];
  createdAt: Date;
  updatedAt: Date;
}

export type SearchBlocksInput = {
  query: string;
  limit?: number;
};

export type BlockSearchResult = {
  id: string;
  title: string;
  /** Relevance from 0 to 1, comparable only within one response. */
  score: number;
  matchedBy: SearchStrategy[];
  matchedOn: SearchMatchField;
  /** The passage that matched, or the start of the block for a title match. */
  excerpt: string;
  /** False when the excerpt is only part of the block's content. */
  excerptIsComplete: boolean;
};
