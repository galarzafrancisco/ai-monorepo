import { useEffect } from "react";
import { Text, DataRowContainer, DataRow } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";

export function ThreadsPage() {
  const { setSectionTitle } = useThreadsCtx();

  // Set page title
  useEffect(() => {
    setSectionTitle("Threads 🧵");
  }, [setSectionTitle]);

  return (
    <DataRowContainer>
      <DataRow>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem' }}>
            <Text size="5" weight="bold">
              🧵 Threads
            </Text>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <Text size="3" tone="muted">
              A thread is a focused stream of intent.
            </Text>
          </div>
          <div>
            <Text size="3" tone="muted">
              Agents and humans collaborate inside threads.
            </Text>
          </div>
        </div>
      </DataRow>
    </DataRowContainer>
  );
}
