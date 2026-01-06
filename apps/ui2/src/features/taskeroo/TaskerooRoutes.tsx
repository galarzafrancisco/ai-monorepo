import { Routes, Route, Navigate } from "react-router-dom";
import { TaskerooLayout } from "./TaskerooLayout";
import { TaskerooPage } from "./TaskerooPage";
import { TaskStatus } from "./types";

export function TaskerooRoutes() {
  return (
    <Routes>
      <Route element={<TaskerooLayout />}>
        <Route index element={<Navigate to="not-started" replace />} />
        <Route path="not-started" element={<TaskerooPage status={TaskStatus.NOT_STARTED} />} />
        <Route path="in-progress" element={<TaskerooPage status={TaskStatus.IN_PROGRESS} />} />
        <Route path="in-review" element={<TaskerooPage status={TaskStatus.FOR_REVIEW} />} />
        <Route path="done" element={<TaskerooPage status={TaskStatus.DONE} />} />
      </Route>
    </Routes>
  );
}
