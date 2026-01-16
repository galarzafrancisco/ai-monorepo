import { useEffect, useMemo } from "react";
import { Avatar, BoardCard, DataRow, Text } from "../../ui/primitives";
import { useTaskerooCtx } from "./TaskerooProvider"
import { TaskStatus } from "./const";
import { TASKEROO_STATUS } from "./const";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Task } from "./types";
import './TaskerooPage.css';

// Helper that should be extracted somewhere else
const elapsedTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.round((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 60) {
    return `${Math.max(diffInMinutes, 1)}m ago`;
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function TaskerooPage({ status }: { status?: TaskStatus }) {

  const isDesktop = useIsDesktop();
  const statusFilter = isDesktop ? undefined : status;
  const { tasks, isLoading, error, setSectionTitle } = useTaskerooCtx();

  // Set page title
  useEffect(() => {
    if (!statusFilter) {
      setSectionTitle("All");
      return;
    }
    setSectionTitle(TASKEROO_STATUS[statusFilter].label);
  }, [statusFilter]);

  // Filter tasks by status
  const filteredTasks = useMemo(() => {
    if (!statusFilter) return tasks;
    return tasks.filter(t => t.status === statusFilter);
  }, [tasks, statusFilter]);

  return (
    <div className={`${isDesktop ? 'full-height' : ''}`}>
      {!isDesktop ?
        <TasksToRows tasks={filteredTasks} />
        :
        <div className="taskeroo-page">
          <BoardView tasks={filteredTasks} />
        </div>
      }
    </div>
  )
}

function TasksToRows({ tasks }: { tasks: Task[] }): JSX.Element {
  return (
    <>
      {
        tasks.map(task =>
          <DataRow
            key={task.id}
            leading={<Avatar name={task.createdBy} size='lg' />}
            topRight={elapsedTime(task.updatedAt)}
            tags={task.tags.map(tag => { return { label: tag.name } })}
          >
            {/* Task ID */}
            <Text className='pre'>
              #{task.id.slice(0, 6)}
            </Text>
            <Text weight="bold" size='3' tone='default'>
              {task.name}
            </Text>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.description}
            </div>

            {/* Assigned */}
            <div style={{ fontSize: 12 }} className="text--tone-muted">
              {task.assignee ? `Assigned: ${task.assignee}` : 'unassigned'} {`- Created by ${task.createdBy}`}
            </div>
          </DataRow>
        )
      }
    </>
  )
}

function TasksToCards({ tasks }: { tasks: Task[] }): JSX.Element {
  return (
    <>
      {tasks.map(task =>
        <BoardCard
          leading={<Avatar name={task.createdBy} size='md' />}
          topRight={elapsedTime(task.updatedAt)}
          tags={task.tags.map(tag => ({ label: tag.name }))}
          footer={
            <>
              <span className="row-detail truncate">#{task.id.slice(0, 6)}</span>
              <span className="row-detail truncate">
                {task.assignee ? `Assigned: ${task.assignee}` : "unassigned"}
              </span>
            </>
          }
        >
          <div className="row-title truncate">{task.name}</div>
          <div className="row-subtitle truncate">{task.description}</div>
        </BoardCard>
      )}
    </>
  )
}

function BoardColumn({ tasks, status }: { tasks: Task[], status: TaskStatus }): JSX.Element {

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => task.status === status);
  }, [tasks, status])

  const label = TASKEROO_STATUS[status].label;

  return (
    <div className="taskeroo-board-column">

      <div className="taskeroo-board-column__header">
        <Text size="3" weight="bold">
          {label}
        </Text>
        <Text size="1" tone="muted">
          {tasks.length}
        </Text>
      </div>
      <div className="taskeroo-board-column__body">
        <TasksToCards tasks={filteredTasks} />
      </div>
    </div>
  )
}

function BoardView({ tasks }: { tasks: Task[] }): JSX.Element {
  Object.entries(TASKEROO_STATUS).forEach(([a, b]) => {
    console.log(a);
  })
  return (
    <div className="taskeroo-board-view">
      <BoardColumn status={TaskStatus.NOT_STARTED} tasks={tasks} />
      <BoardColumn status={TaskStatus.IN_PROGRESS} tasks={tasks} />
      <BoardColumn status={TaskStatus.FOR_REVIEW} tasks={tasks} />
      <BoardColumn status={TaskStatus.DONE} tasks={tasks} />
    </div>
  )
}
