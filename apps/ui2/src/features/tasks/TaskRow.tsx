import { useEffect, useState } from "react";
import { Avatar, DataRow, Text, DataRowAnimation } from "../../ui/primitives";
import { Task } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import './TaskRow.css';

export function TaskRow({ task, animation, onClick, pulseKey }: { task: Task, animation?: DataRowAnimation, onClick?: () => void, pulseKey?: number }): JSX.Element {
  const [pulse, setPulse] = useState(false);
  const avatarActor = task.assigneeActor ?? task.createdByActor;

  useEffect(() => {
    if (pulseKey == null) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1000); // match CSS
    return () => clearTimeout(t);
  }, [pulseKey]);

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

  return (
    <DataRow
      leading={<Avatar name={avatarActor.displayName} size='lg' src={avatarActor.avatarUrl || undefined}/>}
      topRight={elapsedTime(task.updatedAt)}
      tags={tags}
      animation={animation}
      highlight={task.inputRequests.filter(i => !i.resolvedAt)?.length > 0}
      onClick={onClick}
    >
      <Text className='pre'>
        #{task.id.slice(0, 6)}
      </Text>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text weight="bold" size='3' tone='default'>
          <span className="task-row__title">
            <span className="task-row__titleText">{task.name}</span>
            {pulse ? <span className="task-row__pulseDot" aria-hidden /> : null}
          </span>
        </Text>
      </div>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.description}
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        {task.assignee ? `Assigned: @${task.assignee}` : "unassigned"}
        {" · "}
        {`Created by @${task.createdByActor.slug}`}
      </div>
    </DataRow >
  );
}
