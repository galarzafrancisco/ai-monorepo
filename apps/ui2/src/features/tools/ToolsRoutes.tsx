import { Routes, Route } from "react-router-dom";
import { ToolsPage } from "./ToolsPage";
import { ToolsLayout } from "./ToolsLayout";
import { ToolsProvider } from "./ToolsProvider";
import { ToolDetailPage } from "./ToolDetailPage";
import { ClientsPage } from "./ClientsPage";
import { ClientDetailPage } from "./ClientDetailPage";

export function ToolsRoutes() {
  return (
    <ToolsProvider>
      <Routes>
        <Route element={<ToolsLayout />}>
          <Route index element={<ToolsPage />} />
          <Route path="/tool/:toolId" element={<ToolDetailPage />} />
          <Route path="/tool/:toolId/clients" element={<ClientsPage />} />
          <Route path="/tool/:toolId/clients/:clientId" element={<ClientDetailPage />} />
        </Route>
      </Routes>
    </ToolsProvider>
  );
}
