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
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
