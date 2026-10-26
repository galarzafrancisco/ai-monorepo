import { AccessRequestHeardFrom, AccessRequestStatus } from '../../enums';

export type SubmitAccessRequestInput = {
  email: string;
  building?: string | null;
  heardFrom?: AccessRequestHeardFrom | null;
  heardFromOther?: string | null;
};

export type ListAccessRequestsInput = {
  status?: AccessRequestStatus;
  search?: string;
  limit?: number;
  offset?: number;
};

export type AccessRequestResult = {
  id: string;
  email: string;
  building: string | null;
  heardFrom: AccessRequestHeardFrom | null;
  heardFromOther: string | null;
  status: AccessRequestStatus;
  submissionCount: number;
  createdAt: Date;
  lastSubmittedAt: Date;
  reviewedAt: Date | null;
};

export type AccessRequestListResult = {
  items: AccessRequestResult[];
  total: number;
};
