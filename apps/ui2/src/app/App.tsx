import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { AuthProvider, LoginPage, OnboardingPage, ProtectedRoute } from '../auth';
import { OnboardingChecker } from '../auth/OnboardingChecker';
import { BetaShell } from './shells/BetaShell';
import { HomeRoutes } from '../features/home/HomeRoutes';
import { BASE_PATH } from '../shared/const/base';
import './App.css';
import { TasksRoutes } from '../features/tasks/TasksRoutes';
import { LogoutPage } from './routes/LogoutPage';
import { ContextRoutes } from '../features/context/ContextRoutes';
import { AgentsRoutes } from '../features/agents/AgentsRoutes';
import { ThreadsRoutes } from '../features/threads/ThreadsRoutes';
import { ToolsRoutes } from '../features/tools/ToolsRoutes';
import { ConsentRoutes } from '../features/consent/ConsentRoutes';
import { ActorsProvider } from '../features/actors';
import { ToastProvider } from '../shared/context/ToastContext';
import { ToastContainer, CommandPaletteProvider } from '../ui/components';

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
      <Route path="/agents/*" element={<AgentsRoutes />} />
      <Route path="/threads/*" element={<ThreadsRoutes />} />
      <Route path="/tools/*" element={<ToolsRoutes />} />

    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ActorsProvider>
              <CommandPaletteProvider>
                <Routes>
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/login" element={
                    <OnboardingChecker>
                      <LoginPage />
                    </OnboardingChecker>
                  } />
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
                <ToastContainer />
              </CommandPaletteProvider>
            </ActorsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
