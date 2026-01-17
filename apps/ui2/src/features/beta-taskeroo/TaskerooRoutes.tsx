import { Routes, Route, Navigate } from "react-router-dom";
import { TaskerooPage } from "./TaskerooPage";
import { TaskerooLayout } from "./TaskerooLayout";
import { TaskerooProvider } from "./TaskerooProvider";
import { TaskStatus } from "./const";
import { TaskDetailPage } from "./TaskDetailPage";

export function TaskerooRoutes() {
  return (
    <TaskerooProvider>
      <Routes>
        <Route element={<TaskerooLayout />}>
          <Route index element={<Navigate to="/taskeroo/not-started" replace />} />
          {/* <Route path="/" element={<TaskerooPage />} /> */}
          <Route path="/not-started" element={<TaskerooPage status={TaskStatus.NOT_STARTED} />} />
          <Route path="/in-progress" element={<TaskerooPage status={TaskStatus.IN_PROGRESS} />} />
          <Route path="/in-review" element={<TaskerooPage status={TaskStatus.FOR_REVIEW} />} />
          <Route path="/done" element={<TaskerooPage status={TaskStatus.DONE} />} />
          <Route path="/task/:d" element={<TaskDetailPage />} />
        </Route>
      </Routes>
    </TaskerooProvider>
  );
}
