import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BASE_PATH } from '../shared/const/base';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './auth/LoginPage';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './home/HomePage';
import { TaskBoard } from './tasks/TaskBoard';
import { TaskBoardMobile } from './tasks/TaskBoardMobile';
import { ContextWithSidebar } from './context/ContextWithSidebar';
import { ContextHome } from './context/ContextHome';
import { ContextCreate } from './context/ContextCreate';
import { ContextPageView } from './context/ContextPageView';
import { ContextPageEdit } from './context/ContextPageEdit';
import { McpRegistryDashboard } from './mcp-registry/McpRegistryDashboard';
import { McpServerDetail } from './mcp-registry/McpServerDetail';
import { ConsentScreen } from './consent/ConsentScreen';
import { AgentsWithSidebar } from './agents/AgentsWithSidebar';
import { AgentsHome } from './agents/AgentsHome';
import { AgentsAdminList } from './agents/AgentsAdminList';
import { AgentAdminDetail } from './agents/AgentAdminDetail';
import { LogoutPage } from './auth/LogoutPage';
import { useIsMobile } from './hooks/useIsMobile';

function TasksRouter() {
  const isMobile = useIsMobile();
  return isMobile ? <TaskBoardMobile /> : <TaskBoard />;
}

export default function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <AuthProvider>
        <Routes>
          {/* Public route - login page */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/logout" element={<LogoutPage />} />

          {/* Protected routes - require authentication */}
          <Route
            element={
              <ProtectedRoute>
                <RootLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="tasks" element={<TasksRouter />} />
            <Route path="mcp-registry" element={<McpRegistryDashboard />} />
            <Route path="mcp-registry/:serverId" element={<McpServerDetail />} />
            <Route path="consent" element={<ConsentScreen />} />

            {/* Context nested routes with ContextWithSidebar layout */}
            <Route path="context" element={<ContextWithSidebar />}>
              <Route index element={<ContextHome />} />
              <Route path="new" element={<ContextCreate />} />
              <Route path="page/:pageId" element={<ContextPageView />} />
              <Route path="page/:pageId/edit" element={<ContextPageEdit />} />
              <Route path="page/:pageId/new" element={<ContextCreate />} />
            </Route>

            {/* Agents nested routes with AgentsWithSidebar layout */}
            <Route path="agents" element={<AgentsWithSidebar />}>
              <Route index element={<AgentsHome />} />
              <Route path="admin" element={<AgentsAdminList />} />
              <Route path=":agentId/admin" element={<AgentAdminDetail />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
