import { Routes, Route } from "react-router-dom";
import { AgentsPage } from "./AgentsPage";
import { AgentsLayout } from "./AgentsLayout";
import { AgentsProvider } from "./AgentsProvider";
import { AgentDetailPage } from "./AgentDetailPage";
import { AgentToolsPage } from "./AgentToolsPage";

export function AgentsRoutes() {
  return (
    <AgentsProvider>
      <Routes>
        <Route element={<AgentsLayout />}>
          <Route index element={<AgentsPage />} />
          <Route path="/agent/:slug" element={<AgentDetailPage />} />
          <Route path="/agent/:slug/tools" element={<AgentToolsPage />} />
        </Route>
      </Routes>
    </AgentsProvider>
  );
}
