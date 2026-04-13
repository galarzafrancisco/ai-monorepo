import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ThemeProvider } from './providers';
import { AuthProvider, LoginPage, OnboardingPage, ProtectedRoute, useAuth } from '../auth';
import { OnboardingChecker } from '../auth/OnboardingChecker';
import { BetaShell } from './shells/BetaShell';
import { WalkthroughService } from '../features/walkthrough/api';
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
import { ExecutionsRoutes } from '../features/executions/ExecutionsRoutes';
import { ActorsProvider } from '../features/actors';
import { ToastProvider } from '../shared/context/ToastContext';
import { ToastContainer, CommandPaletteProvider } from '../ui/components';

/**
 * Redirects to /walkthrough during render if the user's display mode is FULL_PAGE,
 * then fires the acknowledge call in an effect to downgrade the mode to BANNER.
 * Using <Navigate> in render (not useEffect) ensures the redirect wins over any
 * competing navigations in child components (e.g. the index → /home redirect).
 */
function WalkthroughGate({ children }: { children: React.ReactNode }) {
  const { user, refreshAuth } = useAuth();
  const acknowledgedRef = useRef(false);

  useEffect(() => {
    if (acknowledgedRef.current || !user) return;
    if (user.onboardingDisplayMode === 'FULL_PAGE') {
      acknowledgedRef.current = true;
      WalkthroughService.WalkthroughController_acknowledge()
        .then(() => refreshAuth())
        .catch(console.error);
    }
  }, [user, refreshAuth]);

  if (!acknowledgedRef.current && user?.onboardingDisplayMode === 'FULL_PAGE') {
    return <Navigate to="/walkthrough" replace />;
  }

  return <>{children}</>;
}

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
      <Route path="/runs/*" element={<ExecutionsRoutes />} />
      <Route path="/executions/*" element={<Navigate to="/runs" replace />} />

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
                        <WalkthroughGate>
                          <BetaShell>
                            <BetaAppRoutes />
                          </BetaShell>
                        </WalkthroughGate>
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
