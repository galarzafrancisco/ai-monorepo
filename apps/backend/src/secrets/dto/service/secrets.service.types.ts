export type CreateSecretInput = {
  name: string;
  description?: string | null;
  value: string;
  createdByActorId: string;
};

export type UpdateSecretInput = {
  name?: string;
  description?: string | null;
  value?: string;
};

export type SecretResult = {
  id: string;
  name: string;
  description: string | null;
  createdByActorId: string;
  createdBy: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SecretValueResult = {
  id: string;
  name: string;
  value: string;
};
