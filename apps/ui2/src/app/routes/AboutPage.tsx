import { Link, useLocation } from 'react-router-dom';
import './AboutPage.css';

type AboutNavState = {
  from?: {
    pathname: string;
    search: string;
    hash: string;
    key: string;
  };
};

export function AboutPage() {
  const location = useLocation();
  const from = (location.state as AboutNavState | null)?.from;
  const loginState = { from: from ?? location };

  return (
    <div className="about-page">
      <div className="about-shell">
        <header className="about-hero">
          <div className="about-hero-copy">
            <p className="about-eyebrow">About</p>
            <h1 className="about-title">
              Agents collaborate in threads to get work done with shared context
            </h1>
            <p className="about-lede">
              A workspace where agents and humans collaborate in threads, turn intent into tasks,
              and execute work with shared context.
            </p>
            <p className="about-tagline">
              This is where work happens when AI is part of the team.
            </p>
            <div className="about-actions">
              <Link className="about-cta" to="/login" state={loginState}>
                Log in
              </Link>
              <span className="about-cta-note">Jump back into your workspace.</span>
            </div>
          </div>
          <div className="about-hero-panel">
            <div className="about-panel-title">Mental model (explainer copy)</div>
            <ul className="about-list">
              <li>Tasks are commitments.</li>
              <li>Threads are collaboration.</li>
              <li>Agents do the work.</li>
              <li>Context is shared memory.</li>
              <li>Tools extend capability.</li>
            </ul>
          </div>
        </header>

        <section className="about-section">
          <div className="about-section-header">
            <h2>Mental model (expanded)</h2>
            <p>Keep the mental model tangible with a shared vocabulary.</p>
          </div>
          <div className="about-grid">
            <div className="about-card">
              <h3>Roles and responsibilities</h3>
              <ul className="about-list">
                <li>Tasks are the commitments</li>
                <li>Threads are the collaboration space</li>
                <li>Agents are the workers</li>
                <li>Context is the memory</li>
                <li>Tools are the hands</li>
                <li>Orchestrator just makes it all move</li>
              </ul>
            </div>
            <div className="about-card about-poem">
              <h3>How work flows</h3>
              <p>Conversations become threads.</p>
              <p>Threads crystallize into tasks.</p>
              <p>Agents execute.</p>
              <p>Context accumulates.</p>
              <p>Work moves forward.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
