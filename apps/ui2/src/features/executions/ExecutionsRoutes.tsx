import { Routes, Route } from 'react-router-dom';
import { ExecutionsPage } from './ExecutionsPage';
import { ExecutionsLayout } from './ExecutionsLayout';
import { ExecutionsProvider } from './ExecutionsProvider';

export function ExecutionsRoutes() {
  return (
    <ExecutionsProvider>
      <Routes>
        <Route element={<ExecutionsLayout />}>
          <Route index element={<ExecutionsPage />} />
        </Route>
      </Routes>
    </ExecutionsProvider>
  );
}
