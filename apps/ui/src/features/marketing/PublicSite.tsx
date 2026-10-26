import { Navigate, Route, Routes } from 'react-router-dom';
import { JoinPage } from './JoinPage';
import { MarketingPage } from './MarketingPage';

/** Public, unauthenticated pages. Rendered outside AuthProvider. */
export function PublicSite() {
  return (
    <Routes>
      <Route path="/join" element={<JoinPage />} />
      <Route path="/marketing" element={<MarketingPage />} />
      <Route path="/" element={<JoinPage />} />
      <Route path="*" element={<Navigate to="/join" replace />} />
    </Routes>
  );
}
