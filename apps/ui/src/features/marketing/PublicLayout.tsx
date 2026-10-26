import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { COPYRIGHT_NOTICE } from '../../shared/const/brand';
import './marketing.css';

/**
 * Visitors to the public pages have never used Taico, so the theme they might
 * have picked inside the app means nothing here: these pages always wear the
 * official dark theme. We set it on <html> while mounted (so the page canvas,
 * scrollbars and form controls match) without touching the stored preference,
 * and put the previous value back on the way out.
 */
function usePublicTheme() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'dark');
    return () => {
      if (previous) html.setAttribute('data-theme', previous);
      else html.removeAttribute('data-theme');
    };
  }, []);
}

export function PublicLayout({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  usePublicTheme();
  return (
    <div className="pub" data-theme="dark">
      <header className="pub-nav">
        <Link to="/marketing" className="pub-logo">taico</Link>
        {nav && <nav className="pub-nav__links">{nav}</nav>}
      </header>
      {children}
      <footer className="pub-footer">{COPYRIGHT_NOTICE}</footer>
    </div>
  );
}
