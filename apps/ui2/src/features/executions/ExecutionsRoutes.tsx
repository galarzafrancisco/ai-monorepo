import { Routes, Route } from 'react-router-dom';
import { ExecutionsPage } from './ExecutionsPage';

export function ExecutionsRoutes() {
  return (
    <Routes>
      <Route index element={<ExecutionsPage />} />
    </Routes>
  );
}
