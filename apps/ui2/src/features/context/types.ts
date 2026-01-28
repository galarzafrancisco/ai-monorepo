export type ContextBlock = {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: Array<{ id: string; name: string; color?: string }>;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};
