import { DataRow, Text } from "../../ui/primitives";
import { formatGroupDate } from "./taskGrouping";
import './DaySummaryRow.css';

interface DaySummaryRowProps {
  date: Date;
  taskCount: number;
  isExpanded: boolean;
  onClick: () => void;
}

export function DaySummaryRow({ date, taskCount, isExpanded, onClick }: DaySummaryRowProps): JSX.Element {
  const dateLabel = formatGroupDate(date);
  const chevron = isExpanded ? "▼" : "▶";

  return (
    <DataRow
      onClick={onClick}
      className="day-summary-row"
    >
      <div className="day-summary-row__content">
        <span className="day-summary-row__chevron">{chevron}</span>
        <Text weight="bold" size='3'>
          {dateLabel}
        </Text>
        <Text size='2' tone='muted' className="day-summary-row__count">
          · {taskCount} {taskCount === 1 ? 'task' : 'tasks'} shipped
        </Text>
      </div>
    </DataRow>
  );
}
