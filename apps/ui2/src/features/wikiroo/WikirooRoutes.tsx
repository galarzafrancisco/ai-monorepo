import { Routes, Route, Navigate } from "react-router-dom";
import { WikirooLayout } from "./WikirooLayout";
import { WikirooHome } from "./WikirooHome";
import { IosShell } from "../../app/shells/IosShell";

export function WikirooRoutes() {
  return (
    <Routes>
      <Route element={<WikirooLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="as-props" element={<IosShell
          appTitle="wikiroo"
          sectionTitle="pages"
        ><WikirooHome /></IosShell>
        }>
          <Route path="home" element={<WikirooHome />} />
        </Route>
      </Route>
    </Routes>
  );
}
