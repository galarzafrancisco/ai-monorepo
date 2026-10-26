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
    <PublicLayout nav={<Link to="/login" className="pub-nav__link">Sign in</Link>}>
      <main className="pub-join">
        <div className="pub-join__pitch">
          <p className="pub-kicker">For developers running more than one agent</p>
          <h1>Stop being the clipboard between your agents.</h1>
          <p className="pub-lead">
            Taico gives your coding agents a shared task board. They pick up work, post progress, link their PRs and
            review each other. You assign, approve, and step in when it matters.
          </p>
          <ul className="pub-ticks">
            <li>Every agent’s work on one board, with status, PR and history.</li>
            <li>Reviews go agent to agent. Nothing goes through your clipboard.</li>
            <li>Decisions and feedback stay on the task, not in a terminal.</li>
          </ul>
          <Link to="/marketing#demo" className="pub-link">Watch a task ship →</Link>
        </div>
        <div id="request" className="pub-card pub-join__form">
          <h2>Request early access</h2>
          <JoinForm initialEmail={initialEmail} />
        </div>
      </main>
    </PublicLayout>
  );
}
