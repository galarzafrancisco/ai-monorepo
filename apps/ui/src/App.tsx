import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './home/HomePage';
import { TaskBoard } from './taskeroo/TaskBoard';
import { TaskBoardMobile } from './taskeroo/TaskBoardMobile';
import { WikirooWithSidebar } from './wikiroo/WikirooWithSidebar';
import { WikirooHome } from './wikiroo/WikirooHome';
import { WikirooCreate } from './wikiroo/WikirooCreate';
import { WikirooPageView } from './wikiroo/WikirooPageView';
import { WikirooPageEdit } from './wikiroo/WikirooPageEdit';
import { McpRegistryDashboard } from './mcp-registry/McpRegistryDashboard';
import { McpServerDetail } from './mcp-registry/McpServerDetail';
import { ConsentScreen } from './consent/ConsentScreen';
import { AgentsWithSidebar } from './agents/AgentsWithSidebar';
import { AgentsHome } from './agents/AgentsHome';
import { AgentsChatSession } from './agents/AgentsChatSession';
import { AgentsChatSessionNew } from './agents/AgentsChatSessionNew';
import { AgentsAdminList } from './agents/AgentsAdminList';
import { AgentAdminDetail } from './agents/AgentAdminDetail';

// Simple mobile detection
const isMobile = () => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
};

function TaskerooRouter() {
  return isMobile() ? <TaskBoardMobile /> : <TaskBoard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="taskeroo" element={<TaskerooRouter />} />
          <Route path="mcp-registry" element={<McpRegistryDashboard />} />
          <Route path="mcp-registry/:serverId" element={<McpServerDetail />} />
          <Route path="consent" element={<ConsentScreen />} />

          {/* Wikiroo nested routes with WikirooWithSidebar layout */}
          <Route path="wikiroo" element={<WikirooWithSidebar />}>
            <Route index element={<WikirooHome />} />
            <Route path="new" element={<WikirooCreate />} />
            <Route path="page/:pageId" element={<WikirooPageView />} />
            <Route path="page/:pageId/edit" element={<WikirooPageEdit />} />
            <Route path="page/:pageId/new" element={<WikirooCreate />} />
          </Route>

          {/* Agents nested routes with AgentsWithSidebar layout */}
          <Route path="agents" element={<AgentsWithSidebar />}>
            <Route index element={<AgentsHome />} />
            <Route path="admin" element={<AgentsAdminList />} />
            <Route path=":agentId/admin" element={<AgentAdminDetail />} />
            <Route path=":agentId/session/new" element={<AgentsChatSessionNew />} />
            <Route path=":agentId/session/:sessionId" element={<AgentsChatSession />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
