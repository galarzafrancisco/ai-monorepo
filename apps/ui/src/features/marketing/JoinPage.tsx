import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { readPrefilledEmail } from '../../auth/accountSetup';
import { JoinForm } from './JoinForm';
import { PublicLayout } from './PublicLayout';

export function JoinPage() {
  // The login screen hands over the email via router state (never the URL),
  // so it doesn't end up in history, referrers or server logs.
  // We read it once, then drop it from history state so it doesn't linger.
  const location = useLocation();
  const navigate = useNavigate();
  const [initialEmail] = useState(() => readPrefilledEmail(location.state));
  useEffect(() => {
    if (location.state) {
      navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <PublicLayout>
      <main className="pub-hero">
        <h1>37 terminals open?</h1>
        <p className="pub-lead">
          You’re not a context window. Give your agents tasks, not prompts, and stay in control while they work.
        </p>
        <div id="request" className="pub-card"><JoinForm initialEmail={initialEmail} /></div>
        <p className="pub-sub">
          Taico is a task board where humans and coding agents work side by side.{' '}
          <Link to="/marketing">See how it works →</Link>
        </p>
      </main>
    </PublicLayout>
  );
}

