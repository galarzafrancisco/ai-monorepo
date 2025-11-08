import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './home/HomePage';
import { TaskBoard } from './taskeroo/TaskBoard';
import { WikirooHomePage } from './wikiroo/WikirooHomePage';
import { WikirooPageView } from './wikiroo/WikirooPageView';
import { McpRegistryDashboard } from './mcp-registry/McpRegistryDashboard';
import { McpServerDetail } from './mcp-registry/McpServerDetail';
import { ConsentScreen } from './consent/ConsentScreen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/taskeroo" element={<TaskBoard />} />
        <Route path="/wikiroo" element={<WikirooHomePage />} />
        <Route path="/wikiroo/:pageId" element={<WikirooPageView />} />
        <Route path="/mcp-registry" element={<McpRegistryDashboard />} />
        <Route path="/mcp-registry/:serverId" element={<McpServerDetail />} />
        <Route path="/consent" element={<ConsentScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
