export interface AccessRequestItem {
  id: string;
  email: string;
  building: string | null;
  status: 'new' | 'reviewed';
  submissionCount: number;
  createdAt: string;
  lastSubmittedAt: string;
  reviewedAt: string | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1/admin/access-requests${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Admin access required.' : `Request failed (${res.status}).`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const listAccessRequests = (p: { status?: string; search?: string }) => {
  const q = new URLSearchParams({ limit: '200' });
  if (p.status) q.set('status', p.status);
  if (p.search) q.set('search', p.search);
  return call<{ items: AccessRequestItem[]; total: number }>(`?${q}`);
};
export const setAccessRequestStatus = (id: string, status: 'new' | 'reviewed') =>
  call<AccessRequestItem>(`/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const deleteAccessRequest = (id: string) => call<void>(`/${id}`, { method: 'DELETE' });
