import { Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import { HomeLayout } from "./HomeLayout";
import { HomeProvider } from "./HomeProvider";

export function HomeRoutes() {
  return (
    <HomeProvider>
      <Routes>
        <Route element={<HomeLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/settings" element={<HomePage />} />
        </Route>
      </Routes>
    </HomeProvider>
  );
}
