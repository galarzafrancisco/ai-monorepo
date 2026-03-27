import { Avatar, BoardCard } from "../../ui/primitives";
import { TaskSummaryResponseDto } from "@taico/client";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useNavigate } from "react-router-dom";
import "./ThreadTaskCard.css";

export function ThreadTaskCard({
  task,
}: {
  task: TaskSummaryResponseDto;
}): JSX.Element {
  const navigate = useNavigate();

  // Build tags array similar to TaskCard
  const tags = task.tags.map((tag) => ({ label: tag.name }));
  if (task.commentCount > 0) {
    tags.push({
      label: `💬 ${task.commentCount}`,
    });
  }
  const openQuestions = task.inputRequests.filter((i) => !i.resolvedAt).length;
  if (openQuestions > 0) {
    tags.push({
      label: `✋ ${openQuestions}`,
    });
  }

  const handleClick = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      event.stopPropagation();
      window.open(`/tasks/task/${task.id}`, "_blank");
    } else {
      navigate(`/tasks/task/${task.id}`);
    }
  };

  return (
    <BoardCard
      leading={
        <Avatar
          name={task.createdByActor.displayName}
          size="md"
          src={task.createdByActor.avatarUrl || undefined}
        />
      }
      topRight={elapsedTime(task.updatedAt)}
      tags={tags}
      onClick={handleClick}
      highlight={openQuestions > 0}
      footer={
        <>
          <span className="row-detail truncate">#{task.id.slice(0, 6)}</span>
          <span className="row-detail truncate">
            {task.assigneeActor
              ? `Assigned: @${task.assigneeActor.slug}`
              : "unassigned"}
          </span>
        </>
      }
    >
      <div className="row-title truncate">{task.name}</div>
      <div className="row-subtitle truncate">{task.description}</div>
    </BoardCard>
  );
}
