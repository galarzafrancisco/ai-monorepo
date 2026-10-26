import { ApiClient } from '@taico/client/v2';
import type { AccessRequestResponseDto } from '@taico/client/v2';
import { BFF_BASE_URL } from '../../config/api';

const client = new ApiClient({
  baseUrl: BFF_BASE_URL || window.location.origin,
  credentials: 'include',
});

export type AccessRequestItem = AccessRequestResponseDto;

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const status = (e as { status?: unknown } | null)?.status;
    if (typeof status === 'number') {
      throw new Error(status === 403 ? 'Admin access required.' : `Request failed (${status}).`);
    }
    throw e;
  }
}

export const listAccessRequests = (p: { status?: string; search?: string }) =>
  wrap(
    client.accessRequestsAdmin.AccessRequestsAdminController_list({
      limit: 200,
      status: p.status === 'new' || p.status === 'reviewed' ? p.status : undefined,
      search: p.search || undefined,
    }),
  );

export const setAccessRequestStatus = (id: string, status: 'new' | 'reviewed') =>
  wrap(client.accessRequestsAdmin.AccessRequestsAdminController_update({ id, body: { status } }));

export const deleteAccessRequest = (id: string) =>
  wrap(client.accessRequestsAdmin.AccessRequestsAdminController_remove({ id }));
