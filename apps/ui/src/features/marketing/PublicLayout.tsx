import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './marketing.css';

export function PublicLayout({ children, cta = false }: { children: ReactNode; cta?: boolean }) {
  return (
    <div className="pub">
      <header className="pub-nav">
        <Link to="/join" className="pub-logo">taico</Link>
        {cta && <Link to="/join" className="pub-btn pub-btn--sm">Request access</Link>}
      </header>
      {children}
      <footer className="pub-footer">© Taico</footer>
    </div>
  );
}
