import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Text } from "../../ui/primitives";
import { useTasksCtx, AnimationState } from "./TasksProvider"
import { TaskStatus } from "./const";
import { TASKS_STATUS } from "./const";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Task } from "./types";
import { useToast } from "../../shared/context/ToastContext";
import './TasksPage.css';
import { NewTaskPop } from "./NewTaskPop";
import { TasksToRows } from "./TasksToRows";
import { TasksToCards } from "./TasksToCards";

export function TasksPage({ status }: { status?: TaskStatus }) {

  const isDesktop = useIsDesktop();
  const statusFilter = isDesktop ? undefined : status;
  const { tasks, createTask, setSectionTitle, animationByStatus, globalEnteringIds, globalExitingTasks, activityByTaskId } = useTasksCtx();
  const { showError } = useToast();

  const navigate = useNavigate();

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    if (!statusFilter) {
      setSectionTitle("All Tasks");
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

  const [searchParams, setSearchParams] = useSearchParams();
  const [newTask, setNewTask] = useState<Partial<Task> | null>(null);
  const [showNewTaskPop, setShowNewTaskPop] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowNewTaskPop(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      showError(error);
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
            groupByDay={statusFilter === TaskStatus.DONE}
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
          groupByDay={status === TaskStatus.DONE}
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
