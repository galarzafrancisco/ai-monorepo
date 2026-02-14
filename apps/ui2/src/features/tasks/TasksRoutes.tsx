import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { TasksPage } from "./TasksPage";
import { TasksLayout } from "./TasksLayout";
import { TasksProvider } from "./TasksProvider";
import { TaskStatus } from "./const";
import { TaskDetailPage } from "./TaskDetailPage";
import { ScheduledTasksProvider } from "../scheduled-tasks/ScheduledTasksProvider";
import { ScheduledTasksPage } from "../scheduled-tasks/ScheduledTasksPage";
import { ScheduledTaskDetailPage } from "../scheduled-tasks/ScheduledTaskDetailPage";
import { TaskBlueprintDetailPage } from "../scheduled-tasks/TaskBlueprintDetailPage";

function ScheduledTasksSection() {
  return (
    <ScheduledTasksProvider>
      <Outlet />
    </ScheduledTasksProvider>
  );
}

export function TasksRoutes() {
  return (
    <TasksProvider>
      <Routes>
        <Route element={<TasksLayout />}>
          <Route index element={<Navigate to="/tasks/not-started" replace />} />
          {/* <Route path="/" element={<TasksPage />} /> */}
          <Route path="not-started" element={<TasksPage status={TaskStatus.NOT_STARTED} />} />
          <Route path="in-progress" element={<TasksPage status={TaskStatus.IN_PROGRESS} />} />
          <Route path="in-review" element={<TasksPage status={TaskStatus.FOR_REVIEW} />} />
          <Route path="done" element={<TasksPage status={TaskStatus.DONE} />} />
          <Route path="task/:d" element={<TaskDetailPage />} />
          <Route element={<ScheduledTasksSection />}>
            <Route path="schedule" element={<ScheduledTasksPage />} />
            <Route path="schedule/:scheduleId" element={<ScheduledTaskDetailPage />} />
            <Route path="blueprints/:taskBlueprintId" element={<TaskBlueprintDetailPage />} />
          </Route>
        </Route>
      </Routes>
    </TasksProvider>
  );
}
