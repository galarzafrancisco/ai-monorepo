import { Routes, Route, Navigate } from "react-router-dom";
import { ContextLayout } from "./ContextLayout";
import { ContextHome } from "./ContextHome";
import { ContextBlockDetailPage } from "./ContextBlockDetailPage";
import { ContextProvider } from "./ContextProvider";

export function ContextRoutes() {
  return (
    <ContextProvider>
      <Routes>
        <Route element={<ContextLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<ContextHome />} />
          <Route path="block/:id" element={<ContextBlockDetailPage />} />
        </Route>
      </Routes >
    </ContextProvider>
  );
}
