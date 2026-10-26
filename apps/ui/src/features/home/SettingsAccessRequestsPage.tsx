import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Inbox } from 'lucide-react';
import type { AccessRequestResponseDto, AccessRequestStatus } from '@taico/client/v2';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useHomeCtx } from './HomeProvider';
import { AccessRequestsAdminService } from './accessRequestsApi';
import { heardFromLabel } from '../marketing/accessRequest';
import '../../auth/LoginPage.css';
import './SettingsPage.css';
import './SettingsUsersPage.css';
import './SettingsAccessRequestsPage.css';

type StatusFilter = AccessRequestStatus | 'all';
const PAGE_SIZE = 200;

/**
 * Admin review of expressions of interest from /join. Reviewing never
 * allowlists anyone; inviting is still done from User management.
 * All user-supplied text is rendered as plain React text (no HTML).
 */
export function SettingsAccessRequestsPage() {
  const { setSectionTitle } = useHomeCtx();
  const { user, isLoading: authIsLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState<AccessRequestResponseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<StatusFilter>('new');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setSectionTitle('Access requests');
  }, [setSectionTitle]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await AccessRequestsAdminService.AccessRequestsAdminController_list({
        status: status === 'all' ? undefined : status,
        search: search || undefined,
        limit: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(readError(err, 'Failed to load access requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    if (authIsLoading || !isAdmin) return;
    void load();
  }, [authIsLoading, isAdmin, load]);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim().slice(0, 100));
  };

  const setReviewState = async (item: AccessRequestResponseDto, next: AccessRequestStatus) => {
    setBusyId(item.id);
    setError('');
    try {
      await AccessRequestsAdminService.AccessRequestsAdminController_update({ id: item.id, body: { status: next } });
      await load();
    } catch (err) {
      setError(readError(err, 'Failed to update the request.'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: AccessRequestResponseDto) => {
    if (!window.confirm(`Delete the request from ${item.email}? This can't be undone.`)) return;
    setBusyId(item.id);
    setError('');
    try {
      await AccessRequestsAdminService.AccessRequestsAdminController_remove({ id: item.id });
      await load();
    } catch (err) {
      setError(readError(err, 'Failed to delete the request.'));
    } finally {
      setBusyId(null);
    }
  };

  if (authIsLoading) {
    return (
      <Card padding="5">
        <Text tone="muted">Loading access requests...</Text>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card padding="5">
        <Stack spacing="2">
          <Text size="4" weight="semibold">Admin access required</Text>
          <Text tone="muted">Only admin users can review access requests.</Text>
        </Stack>
      </Card>
    );
  }

  return (
    <div className="settings-users-page">
      <Card padding="5" className="settings-users-page__hero">
        <Stack spacing="2">
          <span className="settings-users-page__hero-icon" aria-hidden="true"><Inbox size={20} /></span>
          <Text size="5" weight="bold">Access requests</Text>
          <Text tone="muted">
            Expressions of interest sent from the public /join page. Reviewing a request doesn’t give anyone access:
            to let someone in, invite them from User management. Delete requests you no longer need.
          </Text>
        </Stack>
      </Card>

      <Card padding="0" className="settings-users-page__list-card">
        <div className="access-requests__toolbar">
          <form className="access-requests__search" onSubmit={onSearch} role="search">
            <label htmlFor="access-requests-search" className="access-requests__sr-only">Search access requests</label>
            <input
              id="access-requests-search"
              className="login-input"
              type="search"
              value={searchInput}
              maxLength={100}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search email or answers"
            />
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </form>
          <label htmlFor="access-requests-status" className="access-requests__sr-only">Filter by status</label>
          <select
            id="access-requests-status"
            className="login-input access-requests__status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="all">All</option>
          </select>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {error ? <ErrorText size="2" weight="medium" className="access-requests__error">{error}</ErrorText> : null}

        <div className="settings-users-page__list" aria-busy={isLoading}>
          {items.map((item) => (
            <div className="access-requests__row" key={item.id}>
              <div className="access-requests__main">
                <Text size="2" weight="semibold" className="access-requests__email">{item.email}</Text>
                {item.building ? (
                  <Text size="2" className="access-requests__answer">{item.building}</Text>
                ) : (
                  <Text size="2" tone="muted">No answer given.</Text>
                )}
                <HeardFrom item={item} />
                <Text size="1" tone="muted">
                  First sent {formatDate(item.createdAt)}
                  {item.submissionCount > 1 ? ` · sent ${item.submissionCount} times, last ${formatDate(item.lastSubmittedAt)}` : ''}
                  {item.reviewedAt ? ` · reviewed ${formatDate(item.reviewedAt)}` : ''}
                </Text>
              </div>
              <div className="settings-users-page__badges">
                <span className={`settings-users-page__badge ${item.status === 'new' ? 'settings-users-page__badge--pending' : 'settings-users-page__badge--active'}`}>
                  {item.status === 'new' ? 'New' : 'Reviewed'}
                </span>
              </div>
              <div className="settings-users-page__actions">
                {item.status === 'new' ? (
                  <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => void setReviewState(item, 'reviewed')}>Mark reviewed</Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => void setReviewState(item, 'new')}>Mark new</Button>
                )}
                <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => void remove(item)}>Delete</Button>
              </div>
            </div>
          ))}
          {!isLoading && items.length === 0 ? (
            <Text tone="muted" className="settings-users-page__empty">
              {search || status !== 'all' ? 'No requests match these filters.' : 'No access requests yet.'}
            </Text>
          ) : null}
          {total > items.length ? (
            <Text size="1" tone="muted" className="settings-users-page__empty">
              Showing the {items.length} most recent of {total}. Narrow the search to find older ones.
            </Text>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/** Attribution answer; older requests predate the question and show nothing. */
function HeardFrom({ item }: { item: AccessRequestResponseDto }) {
  const label = heardFromLabel(item.heardFrom);
  if (!label) return null;
  return (
    <Text size="1" className="access-requests__source">
      <span className="access-requests__source-label">Heard via </span>
      {label}
      {item.heardFromOther ? <>: <span className="access-requests__source-other">{item.heardFromOther}</span></> : null}
    </Text>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function readError(err: unknown, fallback: string) {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 403) return 'Admin access required.';
  if (status === 401) return 'Your session has expired. Sign in again.';
  return err instanceof Error && err.message ? err.message : fallback;
}
