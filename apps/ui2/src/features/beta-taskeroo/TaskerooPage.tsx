import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, BoardCard, DataRow, Text, DataRowAnimation, BoardCardAnimation } from "../../ui/primitives";
import { useTaskerooCtx, AnimationState } from "./TaskerooProvider"
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
  const { tasks, setSectionTitle, animationByStatus, globalEnteringIds, globalExitingTasks } = useTaskerooCtx();

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

  // Get animation state for mobile view
  const mobileAnimationState = useMemo(() => {
    if (!statusFilter) {
      // "All" view uses global animation state
      return { enteringIds: globalEnteringIds, exitingTasks: globalExitingTasks };
    }
    // Filtered view uses per-status animation state
    return {
      enteringIds: animationByStatus[statusFilter].enteringIds,
      exitingTasks: animationByStatus[statusFilter].exitingTasks,
    };
  }, [statusFilter, animationByStatus, globalEnteringIds, globalExitingTasks]);

  return (
    <div className={`${isDesktop ? 'full-height' : ''}`}>
      {!isDesktop ?
        <TasksToRows
          tasks={filteredTasks}
          enteringIds={mobileAnimationState.enteringIds}
          exitingTasks={mobileAnimationState.exitingTasks}
        />
        :
        <div className="taskeroo-page">
          <BoardView tasks={tasks} animationByStatus={animationByStatus} />
        </div>
      }
    </div>
  )
}

function TaskRow({ task, animation, onClick }: { task: Task, animation?: DataRowAnimation, onClick?: () => void }): JSX.Element {
  return (
    <DataRow
      leading={<Avatar name={task.createdBy} size='lg' />}
      topRight={elapsedTime(task.updatedAt)}
      tags={task.tags.map(tag => ({ label: tag.name }))}
      animation={animation}
      onClick={onClick}
    >
      <Text className='pre'>
        #{task.id.slice(0, 6)}
      </Text>
      <Text weight="bold" size='3' tone='default'>
        {task.name}
      </Text>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.description}
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        {task.assignee ? `Assigned: ${task.assignee}` : 'unassigned'} {`- Created by ${task.createdBy}`}
      </div>
    </DataRow>
  );
}

function TasksToRows({ tasks, enteringIds, exitingTasks }: { tasks: Task[], enteringIds: Set<string>, exitingTasks: Task[] }): JSX.Element {
  const navigate = useNavigate();

  // Merge tasks and exitingTasks, sorted by updatedAt (descending) to maintain original order
  const exitingIdSet = new Set(exitingTasks.map(t => t.id));

  const allTasks = [...tasks, ...exitingTasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <>
      {allTasks.map(task => {
        const isExiting = exitingIdSet.has(task.id);
        const isEntering = enteringIds.has(task.id);

        let animation: DataRowAnimation | undefined;
        if (isExiting) animation = 'exiting';
        else if (isEntering) animation = 'entering';

        return (
          <TaskRow
            key={isExiting ? `exiting-${task.id}` : task.id}
            task={task}
            animation={animation}
            onClick={() => navigate(`/taskeroo/task/${task.id}`)}
          />
        );
      })}
    </>
  )
}

function TaskCard({ task, animation, onClick }: { task: Task, animation?: BoardCardAnimation, onClick?: () => void }): JSX.Element {
  return (
    <BoardCard
      leading={<Avatar name={task.createdBy} size='md' />}
      topRight={elapsedTime(task.updatedAt)}
      tags={task.tags.map(tag => ({ label: tag.name }))}
      animation={animation}
      onClick={onClick}
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
  );
}

function TasksToCards({ tasks, enteringIds, exitingTasks }: { tasks: Task[], enteringIds: Set<string>, exitingTasks: Task[] }): JSX.Element {
  const navigate = useNavigate();
  // Merge tasks and exitingTasks, sorted by updatedAt (descending) to maintain original order
  const exitingIdSet = new Set(exitingTasks.map(t => t.id));

  const allTasks = [...tasks, ...exitingTasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <>
      {allTasks.map(task => {
        const isExiting = exitingIdSet.has(task.id);
        const isEntering = enteringIds.has(task.id);

        let animation: BoardCardAnimation | undefined;
        if (isExiting) animation = 'exiting';
        else if (isEntering) animation = 'entering';

        return (
          <TaskCard
            key={isExiting ? `exiting-${task.id}` : task.id}
            task={task}
            animation={animation}
            onClick={() => navigate(`/taskeroo/task/${task.id}`)}
          />
        );
      })}
    </>
  )
}

function BoardColumn({ tasks, status, animationState }: { tasks: Task[], status: TaskStatus, animationState: AnimationState }): JSX.Element {

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
          {filteredTasks.length}
        </Text>
      </div>
      <div className="taskeroo-board-column__body">
        <TasksToCards
          tasks={filteredTasks}
          enteringIds={animationState.enteringIds}
          exitingTasks={animationState.exitingTasks}
        />
      </div>
    </div>
  )
}

function BoardView({ tasks, animationByStatus }: { tasks: Task[], animationByStatus: Record<TaskStatus, AnimationState> }): JSX.Element {
  return (
    <div className="taskeroo-board-view">
      <BoardColumn status={TaskStatus.NOT_STARTED} tasks={tasks} animationState={animationByStatus[TaskStatus.NOT_STARTED]} />
      <BoardColumn status={TaskStatus.IN_PROGRESS} tasks={tasks} animationState={animationByStatus[TaskStatus.IN_PROGRESS]} />
      <BoardColumn status={TaskStatus.FOR_REVIEW} tasks={tasks} animationState={animationByStatus[TaskStatus.FOR_REVIEW]} />
      <BoardColumn status={TaskStatus.DONE} tasks={tasks} animationState={animationByStatus[TaskStatus.DONE]} />
    </div>
  )
}
