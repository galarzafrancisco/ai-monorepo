import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DataRowContainer } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import { ThreadRow } from "./ThreadRow";

export function ThreadsPage() {
  const { threads, setSectionTitle } = useThreadsCtx();
  const navigate = useNavigate();

  // Set page title
  useEffect(() => {
    setSectionTitle("Threads 🧵");
  }, [setSectionTitle]);

  const handleThreadClick = (threadId: string) => {
    navigate(`/threads/${threadId}`);
  };

  return (
    <DataRowContainer>
      {threads.map((thread) => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          onClick={() => handleThreadClick(thread.id)}
        />
      ))}
    </DataRowContainer>
  );
}
