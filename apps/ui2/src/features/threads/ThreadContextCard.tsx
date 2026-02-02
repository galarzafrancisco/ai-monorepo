import { Card, Text } from "../../ui/primitives";
import type { ContextBlockSummaryResponseDto } from "@taico/client";
import "./ThreadContextCard.css";

export function ThreadContextCard({
  contextBlock,
}: {
  contextBlock: ContextBlockSummaryResponseDto;
}): JSX.Element {
  return (
    <Card className="thread-context-card">
      <Text size="2" weight="semibold">
        {contextBlock.title}
      </Text>
      <Text size="1" tone="muted">
        #{contextBlock.id.slice(0, 6)}
      </Text>
    </Card>
  );
}
