import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { DesktopShell, MobileShell } from './shells';
import { HomePage, WikirooPage, MCPRegistryPage, AgentsPage, LogoutPage } from './pages';
import { TaskerooPage } from '../features/taskeroo/TaskerooPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/taskeroo" element={<TaskerooPage />} />
      <Route path="/wikiroo" element={<WikirooPage />} />
      <Route path="/mcp-registry" element={<MCPRegistryPage />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/logout" element={<LogoutPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        {/* Both shells are rendered; CSS controls which one displays */}
        <DesktopShell>
          <AppRoutes />
        </DesktopShell>
        <MobileShell>
          <AppRoutes />
        </MobileShell>
      </ThemeProvider>
    </BrowserRouter>
  );
}
