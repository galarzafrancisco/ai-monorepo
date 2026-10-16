import { useEffect, useState } from "react";
import { useThreadsCtx } from "./ThreadsProvider";
import { ThreadPinButton } from "./ThreadPinButton";

/**
 * Pin icon for the open thread, shown next to its title.
 *
 * The pin state comes from the user's thread list, the same state the list
 * rows show, so both stay in step (other tabs and devices included). The
 * server lists pinned threads on the first page, so a thread missing from the
 * loaded list is not pinned. Right after pinning such a thread, the list
 * catches up through the pin event; until then the control remembers what the
 * user asked for.
 */
export function ThreadPinControl({ threadId }: { threadId: string }): React.JSX.Element {
  const { threads, setThreadPinned } = useThreadsCtx();
  const listed = threads.find((thread) => thread.id === threadId);
  const [requested, setRequested] = useState<boolean | null>(null);

  useEffect(() => {
    setRequested(null);
  }, [threadId]);

  const pinned = listed ? listed.pinned : requested ?? false;

  return (
    <ThreadPinButton
      pinned={pinned}
      variant="header"
      onToggle={(next) => {
        setRequested(next);
        void setThreadPinned(threadId, next);
      }}
    />
  );
}
