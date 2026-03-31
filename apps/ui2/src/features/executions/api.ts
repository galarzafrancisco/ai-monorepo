import { ApiClient } from '@taico/client/v2';
import { BFF_BASE_URL } from '../../config/api';

const baseUrl = BFF_BASE_URL || window.location.origin;
const client = new ApiClient({
  baseUrl,
  credentials: 'include',
});

export const ExecutionsService = client.executions;
