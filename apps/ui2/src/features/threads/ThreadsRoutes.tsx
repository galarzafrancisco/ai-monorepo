import { Routes, Route } from "react-router-dom";
import { ThreadsPage } from "./ThreadsPage";
import { ThreadsLayout } from "./ThreadsLayout";
import { ThreadsProvider } from "./ThreadsProvider";
import { ThreadDetailPage } from "./ThreadDetailPage";

export function ThreadsRoutes() {
  return (
    <ThreadsProvider>
      <Routes>
        <Route element={<ThreadsLayout />}>
          <Route index element={<ThreadsPage />} />
          <Route path="/:id" element={<ThreadDetailPage />} />
        </Route>
      </Routes>
    </ThreadsProvider>
  );
}
