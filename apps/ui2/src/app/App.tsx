import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { AuthProvider, LoginPage, ProtectedRoute } from '../auth';
import { BetaShell } from './shells/BetaShell';
import { HomeRoutes } from '../features/home/HomeRoutes';
import { BASE_PATH } from '../shared/const/base';
import './App.css';
import { TaskerooRoutes } from '../features/beta-taskeroo/TaskerooRoutes';
import { LogoutPage } from './routes/LogoutPage';
import { WikirooRoutes } from '../features/wikiroo/WikirooRoutes';
import { MCPRegistryPage } from './routes/MCPRegistryPage';
import { AgentsPage } from './routes/AgentsPage';

function BetaAppRoutes() {
  return (
    <Routes>
      {/* Top level pages */}
      <Route path="/logout" element={<LogoutPage />} />
      <Route index element={<Navigate to="home" replace />} />

      {/* Features ⬇️ */}
      {/* Home, settings, all the app level stuff */}
      <Route path="/*" element={<HomeRoutes />} />

      {/* Taskeroo with nested routes */}
      <Route path="/taskeroo/*" element={<TaskerooRoutes />} />

      <Route path="/wikiroo/*" element={<WikirooRoutes />} />
      <Route path="/mcp-registry" element={<MCPRegistryPage />} />
      <Route path="/agents" element={<AgentsPage />} />

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
