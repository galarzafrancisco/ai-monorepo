export interface CreatePageInput {
  title: string;
  content: string;
  author: string;
  tagNames?: string[];
  parentId?: string | null;
}

export interface UpdatePageInput {
  title?: string;
  content?: string;
  author?: string;
  tagNames?: string[];
  parentId?: string | null;
  order?: number;
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
  parentId: string | null;
  order: number;
  children?: PageResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PageSummaryResult {
  id: string;
  title: string;
  author: string;
  tags: TagResult[];
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageTreeResult {
  id: string;
  title: string;
  author: string;
  parentId: string | null;
  order: number;
  children: PageTreeResult[];
  createdAt: Date;
  updatedAt: Date;
}
