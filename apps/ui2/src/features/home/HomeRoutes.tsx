import { Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import { HomeLayout } from "./HomeLayout";
import { HomeProvider } from "./HomeProvider";
import { SettingsPage } from "./SettingsPage";
import { SettingsAccountPage } from "./SettingsAccountPage";
import { SettingsAppearancePage } from "./SettingsAppearancePage";

export function HomeRoutes() {
  return (
    <HomeProvider>
      <Routes>
        <Route element={<HomeLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/account" element={<SettingsAccountPage />} />
          <Route path="/settings/appearance" element={<SettingsAppearancePage />} />
        </Route>
      </Routes>
    </HomeProvider>
  );
}
