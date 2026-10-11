import { Navigate, Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import { HomeLayout } from "./HomeLayout";
import { HomeProvider } from "./HomeProvider";
import { SettingsPage } from "./SettingsPage";
import { SettingsAccountPage } from "./SettingsAccountPage";
import { SettingsAppearancePage } from "./SettingsAppearancePage";
import { SettingsProjectsPage } from "./SettingsProjectsPage";
import { SettingsProjectCreatePage } from "./SettingsProjectCreatePage";
import { SettingsModelsPage } from "./SettingsModelsPage";
import { SettingsDataPage } from './SettingsDataPage';
import { SettingsWorkersPage } from './SettingsWorkersPage';
import { SettingsAIUsagePage } from './SettingsAIUsagePage';
import { SettingsUsersPage } from './SettingsUsersPage';
import { WalkthroughPage } from '../walkthrough/WalkthroughPage';

export function HomeRoutes() {
  return (
    <HomeProvider>
      <Routes>
        <Route element={<HomeLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/account" element={<SettingsAccountPage />} />
          <Route path="/settings/appearance" element={<SettingsAppearancePage />} />
          <Route path="/settings/projects" element={<SettingsProjectsPage />} />
          <Route path="/settings/projects/new" element={<SettingsProjectCreatePage />} />
          <Route path="/settings/models" element={<SettingsModelsPage />} />
          {/* Old addresses of the two pages above and below. */}
          <Route path="/settings/chat" element={<Navigate to="/settings/models" replace />} />
          <Route path="/settings/ai-providers" element={<Navigate to="/settings/ai-usage" replace />} />
          <Route path="/settings/workers" element={<SettingsWorkersPage />} />
          <Route path="/settings/ai-usage" element={<SettingsAIUsagePage />} />
          <Route path="/settings/data" element={<SettingsDataPage />} />
          <Route path="/settings/users" element={<SettingsUsersPage />} />
          <Route path="/walkthrough" element={<WalkthroughPage />} />
        </Route>
      </Routes>
    </HomeProvider>
  );
}
