import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ShellWithNavSidebarLayout from "./Layouts/ShellWithNavSidebar";
import RequireAuth from "./components/RequireAuth";
import LoginPage from "./pages/Login";
import HomePage from "./pages/Home";
import LogoutPage from "./pages/Logout";
import { SessionProvider } from "./context/SessionContext";
import PublicLayout from "./Layouts/Public";
import CatalogPage from "./pages/Catalog";
import ServerDetailPage from "./pages/ServerDetail";
import AgentsPage from "./pages/Agents";
import TaskerooPage from "./pages/Taskeroo";
import WikirooPage from "./pages/Wikiroo";
import "./App.css";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/logout" element={<LogoutPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<ShellWithNavSidebarLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/catalog/:id" element={<ServerDetailPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/taskeroo" element={<TaskerooPage />} />
              <Route path="/wikiroo" element={<WikirooPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
