import { Link } from 'react-router-dom';
import { JoinForm } from './JoinForm';
import { PublicLayout } from './PublicLayout';

export function JoinPage() {
  return (
    <PublicLayout>
      <main className="pub-hero">
        <h1>37 terminals open?</h1>
        <p className="pub-lead">
          You’re not a context window. Give your agents tasks, not prompts, and stay in control while they work.
        </p>
        <div id="request" className="pub-card"><JoinForm /></div>
        <p className="pub-sub">
          Taico is a task board where humans and coding agents work side by side.{' '}
          <Link to="/marketing">See how it works →</Link>
        </p>
      </main>
    </PublicLayout>
  );
}
