import { Routes, Route } from 'react-router-dom';
import { ExecutionsPage } from './ExecutionsPage';
import { ExecutionsLayout } from './ExecutionsLayout';

export function ExecutionsRoutes() {
  return (
    <Routes>
      <Route element={<ExecutionsLayout />}>
        <Route index element={<ExecutionsPage />} />
      </Route>
    </Routes>
  );
}
