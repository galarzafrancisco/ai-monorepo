import { ListSessionsRequest, ListSessionsResponse, Session } from '@google/adk';

type Pagination = Pick<ListSessionsRequest, 'limit' | 'offset' | 'page' | 'order'>;

/**
 * Applies the ordering and pagination contract of ADK's `listSessions`
 * (matching `InMemorySessionService`) to an already-fetched list of sessions.
 */
export function paginateSessions(
  sessions: Session[],
  { limit, offset, page, order }: Pagination,
): ListSessionsResponse {
  const all = [...sessions];
  if (order === 'asc') {
    all.sort((a, b) => a.lastUpdateTime - b.lastUpdateTime || a.id.localeCompare(b.id));
  } else if (order === 'desc') {
    all.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime || a.id.localeCompare(b.id));
  }

  const totalItems = all.length;
  if (limit === undefined) {
    return {
      sessions: offset ? all.slice(offset) : all,
      page: 1,
      limit: totalItems,
      totalItems,
      totalPages: totalItems === 0 ? 0 : 1,
    };
  }

  const effectiveOffset = page !== undefined ? (page - 1) * limit : offset ?? 0;
  const effectivePage =
    page !== undefined ? page : limit === 0 ? 1 : Math.floor(effectiveOffset / limit) + 1;

  return {
    sessions: all.slice(effectiveOffset, effectiveOffset + limit),
    page: effectivePage,
    limit,
    totalItems,
    totalPages: limit === 0 ? 0 : Math.ceil(totalItems / limit),
  };
}
