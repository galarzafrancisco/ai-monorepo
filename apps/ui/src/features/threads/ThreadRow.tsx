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
    </DataRow>
  );
}
