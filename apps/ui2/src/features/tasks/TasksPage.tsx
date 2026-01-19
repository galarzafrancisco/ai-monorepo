import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, BoardCard, DataRow, Text, DataRowAnimation, BoardCardAnimation, DataRowContainer } from "../../ui/primitives";
import { useTasksCtx, AnimationState } from "./TasksProvider"
import { TaskStatus } from "./const";
import { TASKS_STATUS } from "./const";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Task } from "./types";
import './TasksPage.css';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { NewTaskPop } from "./NewTaskPop";

export function TasksPage({ status }: { status?: TaskStatus }) {

  const isDesktop = useIsDesktop();
  const statusFilter = isDesktop ? undefined : status;
  const { tasks, createTask, setSectionTitle, animationByStatus, globalEnteringIds, globalExitingTasks } = useTasksCtx();

  const navigate = useNavigate();

  // Set page title
  useEffect(() => {
    if (!statusFilter) {
      setSectionTitle("All");
      return;
    }
    setSectionTitle(TASKS_STATUS[statusFilter].label);
  }, [statusFilter, setSectionTitle]);

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

  const [newTask, setNewTask] = useState<Partial<Task> | null>(null);
  const [showNewTaskPop, setShowNewTaskPop] = useState(false);

  const handleNewTaskCancel = () => {
    console.log('cancel');
    setShowNewTaskPop(false);
  }
  const handleNewTaskSave = async ({ title, description }: { title: string, description: string }): Promise<boolean> => {
    console.log(`save title: ${title} - description: ${description}`);
    setNewTask({
      name: title,
      description: description,
    });
    // Save
    try {
      const task = await createTask({
        name: title,
        description: description,
      });
      if (task) {
        setNewTask(task);
        navigate(`/tasks/task/${task.id}`);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error saving task');
      console.error(error);
      return false;
    }
  }

  return (
    <div className={`${isDesktop ? 'full-height' : ''}`}>
      {!isDesktop ?
        <>
          <TasksToRows
            tasks={filteredTasks}
            enteringIds={mobileAnimationState.enteringIds}
            exitingTasks={mobileAnimationState.exitingTasks}
          />
          <button
            className="tasks-fab"
            type="button"
            onClick={() => setShowNewTaskPop(true)}
            aria-label="Create new task"
          >
            +
          </button>
          {/* {showNewTaskPop ? <Pop onCancel={handleNewTaskCancel} onSave={handleNewTaskSave} /> : null} */}
          {showNewTaskPop ? <NewTaskPop onCancel={handleNewTaskCancel} onSave={handleNewTaskSave} /> : null}
        </>
        :
        <div className="tasks-page">
          <BoardView tasks={tasks} animationByStatus={animationByStatus} />

          <button
            className="tasks-fab tasks-fab--desktop"
            type="button"
            onClick={() => setShowNewTaskPop(true)}
          >
            <span className="tasks-fab__plus">+</span>
            <span className="tasks-fab__label">New task</span>
          </button>

          {showNewTaskPop ? <NewTaskPop onCancel={handleNewTaskCancel} onSave={handleNewTaskSave} /> : null}
        </div>
      }
    </div>
  )
}

function TaskRow({ task, animation, onClick }: { task: Task, animation?: DataRowAnimation, onClick?: () => void }): JSX.Element {
  return (
    <DataRow
      leading={<Avatar name={task.createdByActor.displayName} size='lg' />}
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

function TasksToRows({ tasks, enteringIds, exitingTasks }: { tasks: Task[], enteringIds: Set<string>, exitingTasks: Task[] }): JSX.Element {
  const navigate = useNavigate();

  // Merge tasks and exitingTasks, sorted by updatedAt (descending) to maintain original order
  const exitingIdSet = new Set(exitingTasks.map(t => t.id));

  const allTasks = [...tasks, ...exitingTasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <DataRowContainer>
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
            onClick={() => navigate(`/tasks/task/${task.id}`)}
          />
        );
      })}
    </DataRowContainer>
  )
}

function TaskCard({ task, animation, onClick }: { task: Task, animation?: BoardCardAnimation, onClick?: () => void }): JSX.Element {
  return (
    <BoardCard
      leading={<Avatar name={task.createdByActor.displayName} size='md' />}
      topRight={elapsedTime(task.updatedAt)}
      tags={task.tags.map(tag => ({ label: tag.name }))}
      animation={animation}
      onClick={onClick}
      footer={
        <>
          <span className="row-detail truncate">#{task.id.slice(0, 6)}</span>
          <span className="row-detail truncate">
            {task.assigneeActor ? `Assigned: @${task.assigneeActor.slug}` : "unassigned"}
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
            onClick={() => navigate(`/tasks/task/${task.id}`)}
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

  const label = TASKS_STATUS[status].label;

  return (
    <div className="tasks-board-column">

      <div className="tasks-board-column__header">
        <Text size="3" weight="bold">
          {label}
        </Text>
        <Text size="1" tone="muted">
          {filteredTasks.length}
        </Text>
      </div>
      <div className="tasks-board-column__body">
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
    <div className="tasks-board-view">
      <BoardColumn status={TaskStatus.NOT_STARTED} tasks={tasks} animationState={animationByStatus[TaskStatus.NOT_STARTED]} />
      <BoardColumn status={TaskStatus.IN_PROGRESS} tasks={tasks} animationState={animationByStatus[TaskStatus.IN_PROGRESS]} />
      <BoardColumn status={TaskStatus.FOR_REVIEW} tasks={tasks} animationState={animationByStatus[TaskStatus.FOR_REVIEW]} />
      <BoardColumn status={TaskStatus.DONE} tasks={tasks} animationState={animationByStatus[TaskStatus.DONE]} />
    </div>
  )
}
