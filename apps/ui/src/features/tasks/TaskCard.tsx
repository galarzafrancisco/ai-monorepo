import { Avatar, BoardCard, BoardCardAnimation } from "../../ui/primitives";
import { Task } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import './TaskCard.css';
import { actorHandle, isDeactivated } from "../actors";
import { PullRequestChip, splitArtefactLinks } from "../pull-requests";

export function TaskCard({ task, animation, onClick, pulseKey }: { task: Task, animation?: BoardCardAnimation, onClick?: () => void, pulseKey?: number }): React.JSX.Element {
  const avatarActor = task.assigneeActor ?? task.createdByActor;
  const tags = task.tags.map(tag => ({ label: tag.name }));
  if (task.comments.length) {
    tags.push({
      label: `💬 ${task.comments.length}`
    })
  }
  const openQuestions = task.inputRequests.filter(i => !i.resolvedAt).length;
  if (openQuestions) {
    tags.push({
      label: `✋ ${openQuestions}`
    })
  }
  const { pullRequestUrls, otherCount: otherLinks } = splitArtefactLinks(task.artefacts);
  if (otherLinks) {
    tags.push({
      label: `🔗 ${otherLinks}`
    })
  }
  return (
    <BoardCard
      leading={<Avatar name={avatarActor.displayName} inactive={isDeactivated(avatarActor)} size='md' src={avatarActor.avatarUrl || undefined} />}
      topRight={elapsedTime(task.updatedAt)}
      tags={tags}
      tagExtras={pullRequestUrls.length ? pullRequestUrls.map((url) => (
        <PullRequestChip key={url} url={url} variant="compact" />
      )) : undefined}
      animation={animation}
      onClick={onClick}
      pulseKey={pulseKey}
      highlight={task.inputRequests.filter(i => !i.resolvedAt)?.length > 0}
      footer={
        <>
          <span className="row-detail truncate">#{task.id.slice(0, 6)}</span>
          <span className="row-detail truncate">
            {task.assigneeActor ? `Assigned: ${actorHandle(task.assigneeActor)}` : "unassigned"}
          </span>
        </>
      }
    >
      <div className="row-title truncate">{task.name}</div>
      <div className="row-subtitle truncate">{task.description}</div>
    </BoardCard>
  );
}
