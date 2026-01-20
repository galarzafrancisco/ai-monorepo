import { Routes, Route } from "react-router-dom";
import { AgentsPage } from "./AgentsPage";
import { AgentsLayout } from "./AgentsLayout";
import { AgentsProvider } from "./AgentsProvider";
import { AgentDetailPage } from "./AgentDetailPage";

export function AgentsRoutes() {
  return (
    <AgentsProvider>
      <Routes>
        <Route element={<AgentsLayout />}>
          <Route index element={<AgentsPage />} />
          <Route path="/agent/:slug" element={<AgentDetailPage />} />
        </Route>
      </Routes>
    </AgentsProvider>
  );
}
