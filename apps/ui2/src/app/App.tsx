import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, InAppNavProvider } from './providers';
import { DesktopShell, MobileShell } from './shells';
import { HomePage, SettingsPage, WikirooPage, MCPRegistryPage, AgentsPage, LogoutPage } from './pages';
import { TaskerooLayout } from '../features/taskeroo/TaskerooLayout';
import { TaskerooPage } from '../features/taskeroo/TaskerooPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      {/* Taskeroo with nested routes */}
      <Route path="/taskeroo" element={<TaskerooLayout />}>
        <Route index element={<Navigate to="/taskeroo/not-started" replace />} />
        <Route path="not-started" element={<TaskerooPage status="not-started" />} />
        <Route path="in-progress" element={<TaskerooPage status="in_progress" />} />
        <Route path="in-review" element={<TaskerooPage status="in_review" />} />
        <Route path="done" element={<TaskerooPage status="done" />} />
      </Route>

      <Route path="/wikiroo" element={<WikirooPage />} />
      <Route path="/mcp-registry" element={<MCPRegistryPage />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/logout" element={<LogoutPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <InAppNavProvider>
          {/* Both shells are rendered; CSS controls which one displays */}
          <DesktopShell>
            <AppRoutes />
          </DesktopShell>
          <MobileShell>
            <AppRoutes />
          </MobileShell>
        </InAppNavProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
