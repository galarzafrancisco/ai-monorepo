import "./UnreadBadge.css";

/**
 * Count of unread things: messages by default. Renders nothing at zero.
 * Pass `unit` when counting something else, e.g. "thread".
 */
export function UnreadBadge({
  count,
  unit = "message",
  className,
}: {
  count: number;
  unit?: string;
  className?: string;
}): React.JSX.Element | null {
  if (count <= 0) return null;

  return (
    <span
      className={className ? `unread-badge ${className}` : "unread-badge"}
      aria-label={`${count} unread ${count === 1 ? unit : `${unit}s`}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
