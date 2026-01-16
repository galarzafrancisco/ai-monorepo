import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { AuthProvider, LoginPage, ProtectedRoute } from '../auth';
// import { HomePage, SettingsPage, TaskerooRoute, WikirooRoute, MCPRegistryRoute, AgentsRoute, LogoutPage } from './routes';
import { SettingsPage, TaskerooRoute, WikirooRoute, MCPRegistryRoute, AgentsRoute, LogoutPage } from './routes';
import { IosShell } from './shells/IosShell';
import { Card } from '../ui/primitives';
import { ShellSwitchLayout } from './shells/ShellSwitchLayout.tsx';
import { ShellConfigProvider } from './providers/ShellConfigProvider';
import './App.css';
import { BetaShell } from './shells/BetaShell';
import { HomeRoutes } from '../features/home/HomeRoutes';
import { HomePage } from '../features/home/HomePage';
import { BetaTaskerooRoute } from './routes/BetaTaskerooRoute';
import { BASE_PATH } from '../shared/const/base';

function AppRoutes() {
  return (
    <Routes>
      {/* Top level pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/logout" element={<LogoutPage />} />

      {/* Features ⬇️ */}

      {/* Taskeroo with nested routes */}
      <Route path="/taskeroo/*" element={<TaskerooRoute />} />

      <Route path="/wikiroo/*" element={<WikirooRoute />} />
      <Route path="/mcp-registry" element={<MCPRegistryRoute />} />
      <Route path="/agents" element={<AgentsRoute />} />
    </Routes>
  );
}
// export function Beta() {
//   return (
//     <BrowserRouter basename="/beta">
//       <ThemeProvider>
//         <AuthProvider>
//           <InAppNavProvider>
//             <Routes>
//               {/* Login page - no shell */}
//               <Route path="/login" element={<LoginPage />} />

//               {/* Main app - with shells and auth protection */}
//               <Route
//                 path="/*"
//                 element={
//                   <ProtectedRoute>
//                     <ShellSwitch>
//                       <AppRoutes />
//                     </ShellSwitch>
//                   </ProtectedRoute>
//                 }
//               />
//             </Routes>
//           </InAppNavProvider>
//         </AuthProvider>
//       </ThemeProvider>
//     </BrowserRouter>
//   );
// }

function BetaAppRoutes() {
  return (
    <Routes>
      {/* Top level pages */}
      <Route path="/logout" element={<LogoutPage />} />
      <Route index element={<Navigate to="home" replace />} />

      {/* <Route path="/settings" element={<HomeRoutes />} /> */}
      {/* <Route path="/settings" element={<SettingsPage />} /> */}
      {/* <Route path="/logout" element={<LogoutPage />} /> */}

      {/* Features ⬇️ */}
      {/* Home, settings, all the app level stuff */}
      <Route path="/*" element={<HomeRoutes />} />

      {/* Taskeroo with nested routes */}
      <Route path="/taskeroo/*" element={<BetaTaskerooRoute />} />

      {/* <Route path="/wikiroo/*" element={<WikirooRoute />} /> */}
      {/* <Route path="/mcp-registry" element={<MCPRegistryRoute />} /> */}
      {/* <Route path="/agents" element={<AgentsRoute />} /> */}

    </Routes>
  );
}

export function Gamma() {
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


// export const App = Alpha;
// export const App = Beta;
export const App = Gamma;

// export function App() {
//   return (
//     <HomePage />
//   )
// }
