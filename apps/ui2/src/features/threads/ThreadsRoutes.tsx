import { Routes, Route } from "react-router-dom";
import { ThreadsPage } from "./ThreadsPage";
import { ThreadsLayout } from "./ThreadsLayout";
import { ThreadsProvider } from "./ThreadsProvider";

export function ThreadsRoutes() {
  return (
    <ThreadsProvider>
      <Routes>
        <Route element={<ThreadsLayout />}>
          <Route index element={<ThreadsPage />} />
        </Route>
      </Routes>
    </ThreadsProvider>
  );
}
