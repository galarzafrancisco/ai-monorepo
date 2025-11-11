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

export interface PageResult {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageSummaryResult {
  id: string;
  title: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}
