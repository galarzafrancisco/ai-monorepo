import { Routes, Route } from 'react-router-dom';
import { ExecutionDetailPage, ExecutionsPage } from './ExecutionsPage';
import { ExecutionsLayout } from './ExecutionsLayout';

export function ExecutionsRoutes() {
  return (
    <Routes>
      <Route element={<ExecutionsLayout />}>
        <Route index element={<ExecutionsPage />} />
        <Route path=":kind/:id" element={<ExecutionDetailPage />} />
      </Route>
    </Routes>
  );
}
