import { DataRow, Text } from "../../ui/primitives";
import type { ThreadListItem } from "./types";
import { UnreadBadge } from "./UnreadBadge";
import { ThreadPinButton } from "./ThreadPinButton";

export function ThreadRow({
  thread,
  onClick,
  onTogglePin,
}: {
  thread: ThreadListItem;
  onClick?: () => void;
  /** Shows the pin icon. Called with the state the user asked for. */
  onTogglePin?: (pinned: boolean) => void;
}): React.JSX.Element {
  const badge = thread.unreadCount > 0 ? <UnreadBadge count={thread.unreadCount} /> : null;
  const trailing = onTogglePin ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      {badge}
      <ThreadPinButton pinned={thread.pinned} onToggle={onTogglePin} />
    </span>
  ) : badge ?? undefined;

  return (
    <DataRow onClick={onClick} trailing={trailing}>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text weight="bold" size='3' tone='default'>
          {thread.title}
        </Text>
      </div>
    </DataRow>
  );
}
