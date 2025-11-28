export type CreateSessionInput = {
  agentId: string;
  title?: string;
  project?: string | null;
};

export type UpdateSessionInput = {
  title?: string;
  project?: string | null;
  isArchived?: boolean;
  isPinned?: boolean;
};

export type GetSessionInput = {
  withTasks?: boolean;
};

export type SessionResult = {
  id: string;
  adkSessionId: string;
  agentId: string;
  title: string;
  project: string | null;
  isArchived: boolean;
  isPinned: boolean;
  lastMessageAt: Date;
  referencedTasks?: TaskResult[];
  subscribedTasks?: TaskResult[];
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type TaskResult = {
  id: string;
  name: string;
  description: string;
  status: string;
  assignee: string | null;
};

export type ListSessionsInput = {
  agentId?: string;
  project?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  page: number;
  limit: number;
};

export type ListSessionsResult = {
  items: SessionResult[];
  total: number;
  page: number;
  limit: number;
};
