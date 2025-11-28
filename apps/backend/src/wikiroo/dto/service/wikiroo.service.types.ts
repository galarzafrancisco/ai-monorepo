export interface CreatePageInput {
  title: string;
  content: string;
  author: string;
  tagNames?: string[];
}

export interface UpdatePageInput {
  title?: string;
  content?: string;
  author?: string;
  tagNames?: string[];
}

export interface AppendPageInput {
  content: string;
}

export interface ListPagesInput {
  tag?: string;
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
  color?: string;
}

export interface CreateTagInput {
  name: string;
}

export interface PageResult {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: TagResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PageSummaryResult {
  id: string;
  title: string;
  author: string;
  tags: TagResult[];
  createdAt: Date;
  updatedAt: Date;
}
