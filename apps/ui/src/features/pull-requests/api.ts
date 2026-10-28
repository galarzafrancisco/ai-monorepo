import { ApiClient } from '@taico/client/v2';
import type { PullRequestResponseDto } from '@taico/client/v2';
import { BFF_BASE_URL } from '../../config/api';

const client = new ApiClient({
  baseUrl: BFF_BASE_URL || window.location.origin,
  credentials: 'include',
});

export const PullRequestsService = client.pullRequests;
export type PullRequest = PullRequestResponseDto;
