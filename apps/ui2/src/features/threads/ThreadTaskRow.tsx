import { Avatar, DataRow, Text } from "../../ui/primitives";
import type { TaskSummaryResponseDto } from "@taico/client/v2";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import "../tasks/TaskRow.css";

export function ThreadTaskRow({
  task,
  onClick,
}: {
  task: TaskSummaryResponseDto;
  onClick?: () => void;
}): JSX.Element {
  const avatarActor = task.assigneeActor ?? task.createdByActor;
  const tags = task.tags.map((tag) => ({ label: tag.name }));

  if (task.commentCount > 0) {
    tags.push({ label: `comments ${task.commentCount}` });
  }

  const openQuestions = task.inputRequests.filter((request) => !request.resolvedAt).length;
  if (openQuestions > 0) {
    tags.push({ label: `questions ${openQuestions}` });
  }

  return (
    <DataRow
      leading={
        <Avatar
          name={avatarActor.displayName}
          size="lg"
          src={avatarActor.avatarUrl || undefined}
        />
      }
      topRight={elapsedTime(task.updatedAt)}
      tags={tags}
      highlight={openQuestions > 0}
      onClick={onClick}
    >
      <Text className="pre">#{task.id.slice(0, 6)}</Text>
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <Text weight="bold" size="3" tone="default">
          <span className="task-row__title">
            <span className="task-row__titleText">{task.name}</span>
          </span>
        </Text>
      </div>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {task.description}
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        {task.assigneeActor ? `Assigned: @${task.assigneeActor.slug}` : "unassigned"}
        {" - "}
        {`Created by @${task.createdByActor.slug}`}
      </div>
    </DataRow>
  );
}
