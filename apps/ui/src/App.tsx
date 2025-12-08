import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './home/HomePage';
import { TaskBoard } from './taskeroo/TaskBoard';
import { TaskBoardMobile } from './taskeroo/TaskBoardMobile';
import { WikirooLayout } from './wikiroo/WikirooLayout';
import { WikirooHomeMobile } from './wikiroo/WikirooHomeMobile';
import { WikirooPageViewMobile } from './wikiroo/WikirooPageViewMobile';
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

function WikirooRouter() {
  return isMobile() ? <WikirooHomeMobile /> : <WikirooLayout />;
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

          {/* Wikiroo routes stay flat for now - will be nested in task #12 */}
          <Route path="wikiroo" element={<WikirooRouter />} />
          <Route path="wikiroo/new" element={<WikirooRouter />} />
          <Route path="wikiroo/page/:pageId" element={<WikirooRouter />} />
          <Route path="wikiroo/page/:pageId/edit" element={<WikirooRouter />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
