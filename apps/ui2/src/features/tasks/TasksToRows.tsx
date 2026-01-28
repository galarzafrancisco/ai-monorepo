import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataRowAnimation, DataRowContainer } from "../../ui/primitives";
import { useTasksCtx } from "./TasksProvider"
import { Task } from "./types";
import { TaskRow } from "./TaskRow";
import { DaySummaryRow } from "./DaySummaryRow";
import { groupTasksByDay } from "./taskGrouping";

export function TasksToRows({ tasks, enteringIds, exitingTasks, groupByDay = false }: { tasks: Task[], enteringIds: Set<string>, exitingTasks: Task[], groupByDay?: boolean }): JSX.Element {
  const navigate = useNavigate();
  const { activityByTaskId } = useTasksCtx();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Merge tasks and exitingTasks, sorted by updatedAt (descending) to maintain original order
  const exitingIdSet = new Set(exitingTasks.map(t => t.id));

  const allTasks = [...tasks, ...exitingTasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!groupByDay) {
    return (
      <DataRowContainer>
        {allTasks.map(task => {
          const isExiting = exitingIdSet.has(task.id);
          const isEntering = enteringIds.has(task.id);

          let animation: DataRowAnimation | undefined;
          if (isExiting) animation = 'exiting';
          else if (isEntering) animation = 'entering';

          const activity = activityByTaskId[task.id];

          return (
            <TaskRow
              key={isExiting ? `exiting-${task.id}` : task.id}
              task={task}
              animation={animation}
              pulseKey={activity?.ts}
              onClick={() => navigate(`/tasks/task/${task.id}`)}
            />
          );
        })}
      </DataRowContainer>
    );
  }

  // Group by day
  const groups = groupTasksByDay(allTasks);

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  return (
    <DataRowContainer>
      {groups.map(group => {
        if (group.isToday) {
          // Today's tasks are not grouped, just shown directly
          return group.tasks.map(task => {
            const isExiting = exitingIdSet.has(task.id);
            const isEntering = enteringIds.has(task.id);

            let animation: DataRowAnimation | undefined;
            if (isExiting) animation = 'exiting';
            else if (isEntering) animation = 'entering';

            const activity = activityByTaskId[task.id];

            return (
              <TaskRow
                key={isExiting ? `exiting-${task.id}` : task.id}
                task={task}
                animation={animation}
                pulseKey={activity?.ts}
                onClick={() => navigate(`/tasks/task/${task.id}`)}
              />
            );
          });
        }

        // Past days: show summary row with expand/collapse
        const isExpanded = expandedDays.has(group.dateKey);

        return (
          <div key={group.dateKey}>
            <DaySummaryRow
              date={group.date}
              taskCount={group.tasks.length}
              isExpanded={isExpanded}
              onClick={() => toggleDay(group.dateKey)}
            />
            {isExpanded && group.tasks.map(task => {
              const isExiting = exitingIdSet.has(task.id);
              const isEntering = enteringIds.has(task.id);

              let animation: DataRowAnimation | undefined;
              if (isExiting) animation = 'exiting';
              else if (isEntering) animation = 'entering';

              const activity = activityByTaskId[task.id];

              return (
                <TaskRow
                  key={isExiting ? `exiting-${task.id}` : task.id}
                  task={task}
                  animation={animation}
                  pulseKey={activity?.ts}
                  onClick={() => navigate(`/tasks/task/${task.id}`)}
                />
              );
            })}
          </div>
        );
      })}
    </DataRowContainer>
  );
}
