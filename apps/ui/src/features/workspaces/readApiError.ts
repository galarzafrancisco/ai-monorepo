/** The problem-details message of a failed API call, or `fallback`. */
export function readApiError(err: unknown, fallback: string): string {
  const e = err as { body?: { detail?: string; title?: string }; message?: string } | null;
  return e?.body?.detail || e?.body?.title || e?.message || fallback;
}
