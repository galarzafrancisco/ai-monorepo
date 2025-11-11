export interface CreatePageInput {
  title: string;
  content: string;
  author: string;
}

export interface UpdatePageInput {
  title?: string;
  content?: string;
  author?: string;
}

export interface AppendPageInput {
  content: string;
}

export interface TagResult {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddTagInput {
  name: string;
  color?: string;
  description?: string;
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
