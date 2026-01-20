import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { AuthProvider, LoginPage, ProtectedRoute } from '../auth';
import { BetaShell } from './shells/BetaShell';
import { HomeRoutes } from '../features/home/HomeRoutes';
import { BASE_PATH } from '../shared/const/base';
import './App.css';
import { TasksRoutes } from '../features/tasks/TasksRoutes';
import { LogoutPage } from './routes/LogoutPage';
import { ContextRoutes } from '../features/context/ContextRoutes';
import { MCPRegistryPage } from './routes/MCPRegistryPage';
import { AgentsRoutes } from '../features/agents/AgentsRoutes';
import { ConsentRoutes } from '../features/consent/ConsentRoutes';

function BetaAppRoutes() {
  return (
    <Routes>
      {/* Top level pages */}
      <Route path="/logout" element={<LogoutPage />} />
      <Route index element={<Navigate to="home" replace />} />
      <Route path="/consent" element={<ConsentRoutes />} />
      {/* Features ⬇️ */}
      {/* Home, settings, all the app level stuff */}
      <Route path="/*" element={<HomeRoutes />} />

      {/* Tasks with nested routes */}
      <Route path="/tasks/*" element={<TasksRoutes />} />

      <Route path="/context/*" element={<ContextRoutes />} />
      <Route path="/mcp-registry" element={<MCPRegistryPage />} />
      <Route path="/agents/*" element={<AgentsRoutes />} />

    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path='*'
              element={
                <ProtectedRoute>
                  <BetaShell>
                    <BetaAppRoutes />
                  </BetaShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
