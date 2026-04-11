import { BoardCard } from "../../ui/primitives";
import { formatGroupDate } from "./taskGrouping";
import './DaySummaryCard.css';

interface DaySummaryCardProps {
  date: Date;
  taskCount: number;
  isExpanded: boolean;
  onClick: () => void;
}

export function DaySummaryCard({ date, taskCount, isExpanded, onClick }: DaySummaryCardProps): React.JSX.Element {
  const dateLabel = formatGroupDate(date);
  const chevron = isExpanded ? "▼" : "▶";

  return (
    <div className="day-summary-card__content" onClick={onClick}>
      <span className="day-summary-card__chevron">{chevron}</span>
      <span className="day-summary-card__text">
        <strong>{dateLabel}</strong> · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </span>
    </div>
  );
}
