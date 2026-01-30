import { Card, Text, Avatar } from "../../ui/primitives";
import { TaskSummaryResponseDto } from "shared";
import "./ThreadTaskCard.css";

const STATUS_LABELS: Record<TaskSummaryResponseDto.status, string> = {
  [TaskSummaryResponseDto.status.NOT_STARTED]: "Not Started",
  [TaskSummaryResponseDto.status.IN_PROGRESS]: "In Progress",
  [TaskSummaryResponseDto.status.FOR_REVIEW]: "For Review",
  [TaskSummaryResponseDto.status.DONE]: "Done",
};

export function ThreadTaskCard({
  task,
}: {
  task: TaskSummaryResponseDto;
}): JSX.Element {
  return (
    <Card className="thread-task-card">
      <div className="thread-task-card__header">
        <Avatar
          name={task.createdByActor.displayName}
          size="sm"
          src={task.createdByActor.avatarUrl || undefined}
        />
        <Text size="1" tone="muted">
          #{task.id.slice(0, 6)}
        </Text>
      </div>
      <Text size="2" weight="semibold">
        {task.name}
      </Text>
      <div className="thread-task-card__footer">
        <Text size="1" tone="muted">
          {STATUS_LABELS[task.status]}
        </Text>
        {task.assigneeActor && (
          <Text size="1" tone="muted">
            @{task.assigneeActor.slug}
          </Text>
        )}
      </div>
    </Card>
  );
}
