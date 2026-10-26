import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Each pair is a pain a developer running agents knows, and what Taico turns it into. */
const SHIFTS = [
  { pain: '37 terminals open. One of you.', shift: 'One board. Every agent on it.' },
  { pain: 'Pasting review comments from one agent into another.', shift: 'Agents hand work to each other.' },
  { pain: 'Re-explaining the codebase every new session.', shift: 'Context lives on the task, not in your head.' },
  { pain: 'Scrolling a terminal to see if it’s done.', shift: 'Status, PR and history on every task.' },
  { pain: 'Prompting all day.', shift: 'You’re the tech lead now.' },
];

const HOLD_MS = 5200;

/**
 * The hero's moving part: a pain gets struck through and the shift replaces it.
 * Advances on its own, pauses on hover or focus, and has a visible pause button
 * (anything that moves for more than 5s needs one). Reduced motion: no autoplay.
 */
export function Shift() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  // The active segment's fill animation is the clock: it pauses with the hover,
  // and its end advances the slide, so the bar and the slide never drift apart.
  const auto = !reduced && !paused;
  const running = auto && !hover;

  const s = SHIFTS[i];
  return (
    <div className={`pub-shift${hover ? ' is-held' : ''}`} aria-roledescription="carousel" aria-label="What changes with Taico"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
      <div key={i} className={`pub-shift__slide${reduced ? ' is-static' : ''}`} aria-live={running ? 'off' : 'polite'}>
        <p className="pub-shift__pain"><s>{s.pain}</s></p>
        <p className="pub-shift__new">{s.shift}</p>
      </div>
      <div className="pub-shift__nav">
        <button type="button" className="pub-shift__toggle" aria-label={paused ? 'Play' : 'Pause'}
          onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        {SHIFTS.map((x, d) => (
          <button key={d} type="button" aria-label={x.shift} aria-current={d === i}
            className={`pub-shift__seg${d === i ? ' is-on' : ''}`}
            onClick={() => setI(d)}>
            {d === i && auto && (
              <span key={i} className="pub-shift__fill" style={{ animationDuration: `${HOLD_MS}ms` }}
                onAnimationEnd={() => setI((n) => (n + 1) % SHIFTS.length)} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
