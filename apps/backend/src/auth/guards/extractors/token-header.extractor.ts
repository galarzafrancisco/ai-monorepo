/*
Dumb helper that extracts the Bearer auth header from a request.
*/

import { IncomingHttpHeaders } from 'http';

export function tokenFromHeaders(headers: IncomingHttpHeaders): string | null {
  const raw = headers['authorization'];
  if (typeof raw !== 'string' || raw.length === 0) return null;

  // Accept exactly "Bearer <token>" (case-insensitive on scheme).
  const [scheme, ...rest] = raw.split(' ');
  if (!scheme || rest.length === 0) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}
