import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, InAppNavProvider } from './providers';
import { AuthProvider, LoginPage, ProtectedRoute } from '../auth';
import { DesktopShell, MobileShell } from './shells';
import { HomePage, SettingsPage, WikirooPage, MCPRegistryPage, AgentsPage, LogoutPage } from './pages';
import { TaskerooLayout } from '../features/taskeroo/TaskerooLayout';
import { TaskerooPage } from '../features/taskeroo/TaskerooPage';
import { TaskStatus } from '../features/taskeroo/types';
import { ShellSwitch } from './shells/ShellSwitch';

function AppRoutes() {
  return (
    <Routes>
      {/* Login page - no shell */}
      <Route path="/login" element={<LoginPage />} />

      {/* Main app routes - wrapped in shells */}
      <Route path="/" element={<HomePage />} />

      {/* Taskeroo with nested routes */}
      <Route path="/taskeroo" element={<TaskerooLayout />}>
        <Route index element={<Navigate to="/taskeroo/not-started" replace />} />
        <Route path="not-started" element={<TaskerooPage status={TaskStatus.NOT_STARTED} />} />
        <Route path="in-progress" element={<TaskerooPage status={TaskStatus.IN_PROGRESS} />} />
        <Route path="in-review" element={<TaskerooPage status={TaskStatus.FOR_REVIEW} />} />
        <Route path="done" element={<TaskerooPage status={TaskStatus.DONE} />} />
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
        <AuthProvider>
          <InAppNavProvider>
            <Routes>
              {/* Login page - no shell */}
              <Route path="/login" element={<LoginPage />} />

              {/* Main app - with shells and auth protection */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <ShellSwitch>
                      <AppRoutes />
                    </ShellSwitch>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </InAppNavProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
