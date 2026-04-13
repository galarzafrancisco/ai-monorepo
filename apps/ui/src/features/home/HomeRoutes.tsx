import { Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import { HomeLayout } from "./HomeLayout";
import { HomeProvider } from "./HomeProvider";
import { SettingsPage } from "./SettingsPage";
import { SettingsAccountPage } from "./SettingsAccountPage";
import { SettingsAppearancePage } from "./SettingsAppearancePage";
import { SettingsProjectsPage } from "./SettingsProjectsPage";
import { SettingsChatPage } from "./SettingsChatPage";
import { SettingsDataPage } from './SettingsDataPage';
import { SettingsWorkersPage } from './SettingsWorkersPage';
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
          <Route path="/settings/chat" element={<SettingsChatPage />} />
          <Route path="/settings/workers" element={<SettingsWorkersPage />} />
          <Route path="/settings/data" element={<SettingsDataPage />} />
          <Route path="/walkthrough" element={<WalkthroughPage />} />
        </Route>
      </Routes>
    </HomeProvider>
  );
}
