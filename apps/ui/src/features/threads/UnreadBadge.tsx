import "./UnreadBadge.css";

/** Count of unread messages in a thread. Renders nothing at zero. */
export function UnreadBadge({ count }: { count: number }): React.JSX.Element | null {
  if (count <= 0) return null;

  return (
    <span
      className="unread-badge"
      aria-label={`${count} unread ${count === 1 ? "message" : "messages"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
