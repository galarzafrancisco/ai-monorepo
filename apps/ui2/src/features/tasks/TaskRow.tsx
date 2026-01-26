import { useEffect, useState } from "react";
import { Avatar, DataRow, Text, DataRowAnimation } from "../../ui/primitives";
import { Task } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import './TaskRow.css';

export function TaskRow({ task, animation, onClick, pulseKey }: { task: Task, animation?: DataRowAnimation, onClick?: () => void, pulseKey?: number }): JSX.Element {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pulseKey == null) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1000); // match CSS
    return () => clearTimeout(t);
  }, [pulseKey]);

  return (
    <DataRow
      leading={<Avatar name={task.createdByActor.displayName} size='lg' src={task.createdByActor.avatarUrl || undefined}/>}
      topRight={elapsedTime(task.updatedAt)}
      tags={task.tags.map(tag => ({ label: tag.name }))}
      animation={animation}
      highlight={task.inputRequests?.length > 0}
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
        {task.comments.length > 0 && (
          <span
            style={{
              marginLeft: 8,
              padding: "1px 6px",
              borderRadius: 999,
              fontSize: 11,
              background: "var(--surface-2)",
              color: "var(--text-muted)",
            }}
          >
            [ 💬 {task.comments.length} ]
          </span>
        )}
      </div>
    </DataRow >
  );
}
