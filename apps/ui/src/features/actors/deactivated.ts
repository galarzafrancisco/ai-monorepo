// Deleted actors stay attached to the work they touched. Their slug is given
// back on deletion and stored with this marker, which is not worth showing.
const DELETED_SLUG_MARKER = "~deleted-";

type MaybeDeletedActor = { slug: string; deletedAt?: string | null };

export function isDeactivated(actor?: { deletedAt?: string | null } | null): boolean {
  return Boolean(actor?.deletedAt);
}

/** "@slug" for active actors, "@slug · deactivated" for deleted ones. */
export function actorHandle(actor: MaybeDeletedActor): string {
  if (!isDeactivated(actor)) return `@${actor.slug}`;
  const originalSlug = actor.slug.split(DELETED_SLUG_MARKER)[0];
  return `@${originalSlug} · deactivated`;
}
