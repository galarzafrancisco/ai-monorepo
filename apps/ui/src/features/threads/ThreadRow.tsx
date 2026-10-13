import { DataRow, Text } from "../../ui/primitives";
import type { ThreadListItem } from "./types";
import { UnreadBadge } from "./UnreadBadge";

export function ThreadRow({
  thread,
  onClick
}: {
  thread: ThreadListItem;
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <DataRow
      onClick={onClick}
      trailing={thread.unreadCount > 0 ? <UnreadBadge count={thread.unreadCount} /> : undefined}
    >
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text weight="bold" size='3' tone='default'>
          {thread.title}
        </Text>
      </div>
    </DataRow>
  );
}
