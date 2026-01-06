import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, InAppNavProvider } from './providers';
import { AuthProvider, LoginPage, ProtectedRoute } from '../auth';
import { HomePage, SettingsPage, TaskerooRoute, WikirooRoute, MCPRegistryRoute, AgentsRoute, LogoutPage } from './routes';
import { ShellSwitch } from './shells/ShellSwitch';


function AppRoutes() {
  return (
    <Routes>
      {/* Top level pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/logout" element={<LogoutPage />} />

      {/* Features ⬇️ */}

      {/* Taskeroo with nested routes */}
      <Route path="/taskeroo/*" element={<TaskerooRoute />}  />

      <Route path="/wikiroo" element={<WikirooRoute />} />
      <Route path="/mcp-registry" element={<MCPRegistryRoute />} />
      <Route path="/agents" element={<AgentsRoute />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename='/beta'>
      <ThemeProvider>
        <AuthProvider>
          <InAppNavProvider>
            <Routes>
              {/* Login page - no shell */}
              <Route path="/login" element={<LoginPage/>} />

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
