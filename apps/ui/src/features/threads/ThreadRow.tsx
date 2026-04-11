import { DataRow, Text } from "../../ui/primitives";
import type { ThreadListItem } from "./types";

export function ThreadRow({
  thread,
  onClick
}: {
  thread: ThreadListItem;
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <DataRow onClick={onClick}>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text weight="bold" size='3' tone='default'>
          {thread.title}
        </Text>
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        #{thread.id.slice(0, 6)}
      </div>
    </DataRow>
  );
}
