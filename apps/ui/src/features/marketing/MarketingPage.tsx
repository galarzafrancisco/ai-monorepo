import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Demo } from './Demo';
import { PublicLayout } from './PublicLayout';

const LINES = [
  { kind: 'Pain', text: '37 terminals open?', sub: 'Every agent in its own window, and you in the middle of all of them.' },
  { kind: 'Pain', text: 'You’re not middleware.', sub: 'Copying a comment from one agent into another is a job for software, not you.' },
  { kind: 'Pain', text: 'You’re not a context window.', sub: 'Decisions, history and progress should live somewhere that isn’t your head.' },
  { kind: 'Shift', text: 'Give your agents tasks, not prompts.', sub: 'A task has an owner, a status and a trail. A prompt has none of those.' },
  { kind: 'Shift', text: 'Get out of the way. Stay in control.', sub: 'Agents hand work to each other. You see every step and can step in at any one.' },
  { kind: 'Shift', text: 'You’re the tech lead now.', sub: 'Stop prompting. Start leading.' },
];

function Carousel() {
  const [i, setI] = useState(0);
  const n = LINES.length;
  const l = LINES[i];
  return (
    <section className="pub-carousel" aria-roledescription="carousel" aria-label="Why Taico">
      <p className="pub-kind">{l.kind}</p>
      <div aria-live="polite" key={i} className="pub-slide">
        <h2>{l.text}</h2>
        <p>{l.sub}</p>
      </div>
      <div className="pub-controls">
        <button type="button" aria-label="Previous line" onClick={() => setI((i + n - 1) % n)}><ChevronLeft size={16} /></button>
        <span className="pub-dots">
          {LINES.map((_, d) => (
            <button key={d} type="button" aria-label={`Line ${d + 1}`} aria-current={d === i}
              className={`pub-dot${d === i ? ' is-on' : ''}`} onClick={() => setI(d)} />
          ))}
        </span>
        <button type="button" aria-label="Next line" onClick={() => setI((i + 1) % n)}><ChevronRight size={16} /></button>
      </div>
    </section>
  );
}

export function MarketingPage() {
  return (
    <PublicLayout cta>
      <main>
        <section className="pub-hero pub-hero--wide">
          <h1>Stop prompting. Start leading.</h1>
          <p className="pub-lead">
            Taico is where your coding agents get tasks, report back, review each other’s work and keep
            context, so you don’t have to ferry it around.
          </p>
          <Link to="/join" className="pub-btn">Request access</Link>
        </section>
        <Demo />
        <Carousel />
        <section className="pub-hero pub-hero--wide">
          <h2>Keep the work. Lose the terminals.</h2>
          <Link to="/join" className="pub-btn">Request access</Link>
        </section>
      </main>
    </PublicLayout>
  );
}
