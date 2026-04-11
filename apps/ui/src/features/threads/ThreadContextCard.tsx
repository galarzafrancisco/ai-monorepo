import { Card, Text, Chip } from "../../ui/primitives";
import { useNavigate } from "react-router-dom";
type ThreadContextCardData = {
  id: string;
  title: string;
};
import "./ThreadContextCard.css";

export function ThreadContextCard({
  contextBlock,
  isStateMemory = false,
}: {
  contextBlock: ThreadContextCardData;
  isStateMemory?: boolean;
}): React.JSX.Element {
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      event.stopPropagation();
      window.open(`/context/block/${contextBlock.id}`, "_blank");
    } else {
      navigate(`/context/block/${contextBlock.id}`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/context/block/${contextBlock.id}`);
    }
  };

  return (
    <Card className="thread-context-card">
      <div
        className="thread-context-card__content"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Text size="2" weight="semibold">
          {contextBlock.title}
        </Text>
        <div className="thread-context-card__meta">
          <Text size="1" tone="muted">
            #{contextBlock.id.slice(0, 6)}
          </Text>
          {isStateMemory && <Chip color="blue">State</Chip>}
        </div>
      </div>
    </Card>
  );
}
