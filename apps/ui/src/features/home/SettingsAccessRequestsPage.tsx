import { useCallback, useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useHomeCtx } from './HomeProvider';
import {
  deleteAccessRequest, listAccessRequests, setAccessRequestStatus, type AccessRequestItem,
} from './accessRequestsApi';
import '../../auth/LoginPage.css';
import './SettingsPage.css';
import './SettingsUsersPage.css';

export function SettingsAccessRequestsPage() {
  const { setSectionTitle } = useHomeCtx();
  const { user, isLoading: authIsLoading } = useAuth();
  const [items, setItems] = useState<AccessRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => { setSectionTitle('Access requests'); }, [setSectionTitle]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await listAccessRequests({ status: status || undefined, search: search.trim() || undefined });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load access requests.');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    if (authIsLoading || !isAdmin) return;
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [authIsLoading, isAdmin, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
  };

  if (authIsLoading) return <Card padding="5"><Text tone="muted">Loading...</Text></Card>;
  if (!isAdmin) {
    return (
      <Card padding="5">
        <Stack spacing="2">
          <Text size="4" weight="semibold">Admin access required</Text>
          <Text tone="muted">Only admin users can see access requests.</Text>
        </Stack>
      </Card>
    );
  }

  const fmt = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="settings-users-page">
      <Card padding="5" className="settings-users-page__hero">
        <Stack spacing="2">
          <span className="settings-users-page__hero-icon" aria-hidden="true"><Inbox size={20} /></span>
          <Text size="5" weight="bold">Access requests</Text>
          <Text tone="muted">
            Expressions of interest from the public /join page. Reviewing a request does not create an account or
            allowlist anyone; invite people from Users. Delete requests you no longer need.
          </Text>
        </Stack>
      </Card>

      <Card padding="5">
        <Stack spacing="4">
          <div className="settings-users-page__create-grid">
            <Stack spacing="2">
              <label className="login-label" htmlFor="ar-search"><Text size="2" weight="medium">Search</Text></label>
              <input id="ar-search" className="login-input" type="search" value={search} maxLength={100}
                onChange={(e) => setSearch(e.target.value)} placeholder="Email or description" />
            </Stack>
            <Stack spacing="2">
              <label className="login-label" htmlFor="ar-status"><Text size="2" weight="medium">Status</Text></label>
              <select id="ar-status" className="login-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </Stack>
          </div>
          {error && <ErrorText size="2" weight="medium">{error}</ErrorText>}
          <Text size="1" tone="muted">{loading ? 'Loading…' : `${total} request${total === 1 ? '' : 's'}`}</Text>
          {!loading && items.length === 0 && <Text tone="muted">No access requests found.</Text>}
          <Stack spacing="3">
            {items.map((r) => (
              <Card key={r.id} padding="4">
                <Stack spacing="2">
                  {/* React escapes all text; user-supplied content is never rendered as HTML. */}
                  <Text weight="semibold">{r.email}</Text>
                  {r.building && <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Text size="2">{r.building}</Text></div>}
                  <Text size="1" tone="muted">
                    {r.status === 'new' ? 'New' : `Reviewed ${r.reviewedAt ? fmt(r.reviewedAt) : ''}`} · received {fmt(r.createdAt)}
                    {r.submissionCount > 1 && ` · submitted ${r.submissionCount}× (last ${fmt(r.lastSubmittedAt)})`}
                  </Text>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" size="sm"
                      onClick={() => void act(() => setAccessRequestStatus(r.id, r.status === 'new' ? 'reviewed' : 'new'))}>
                      {r.status === 'new' ? 'Mark reviewed' : 'Mark new'}
                    </Button>
                    <Button type="button" variant="secondary" size="sm"
                      onClick={() => { if (window.confirm(`Delete the request from ${r.email}?`)) void act(() => deleteAccessRequest(r.id)); }}>
                      Delete
                    </Button>
                  </div>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>
    </div>
  );
}
