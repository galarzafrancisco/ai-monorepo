import { Routes, Route, Navigate } from "react-router-dom";
import { WikirooLayout } from "./WikirooLayout";
import { WikirooHome } from "./WikirooHome";
import { WikirooProvider } from "./WikirooProvider";

export function WikirooRoutes() {
  return (
    <WikirooProvider>
      <Routes>
        <Route element={<WikirooLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<WikirooHome />} />
        </Route>
      </Routes >
    </WikirooProvider>
  );
}
