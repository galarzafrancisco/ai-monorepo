import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { ACTORS, DEMO_EVENTS, PR_URL, TASK_TITLE, reduceDemo } from './demoScript';
import type { Message, TaskStatus } from './demoScript';

const STEP_MS = 1900;
const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', FOR_REVIEW: 'For review', DONE: 'Done',
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function Bubble({ m }: { m: Message }) {
  const a = ACTORS[m.by];
  return (
    <li className="pub-msg">
      <span className={`pub-avatar pub-avatar--${a.kind}`} aria-hidden="true">{a.name[0]}</span>
      <div className="pub-msg__body">
        <div className="pub-msg__name">{a.name}{a.kind === 'agent' && <span className="pub-tag">agent</span>}</div>
        <p>{m.text}</p>
        {m.reminder && (
          <div className="pub-reminder">
            <strong>Reminder scheduled</strong>
            <span>{m.reminder.title}</span>
            <span className="pub-mono">{m.reminder.when}</span>
          </div>
        )}
      </div>
    </li>
  );
}

export function Demo() {
  const last = DEMO_EVENTS.length - 1;
  const reduced = usePrefersReducedMotion();
  // Autoplay once unless the user prefers reduced motion; pause/step/skip at any time.
  const [step, setStep] = useState(0);
  const [wantPlay, setWantPlay] = useState(() => !reduced);
  const playing = wantPlay && step < last;
  const setPlaying = (f: boolean | ((p: boolean) => boolean)) => setWantPlay(typeof f === 'function' ? f(playing) : f);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step]);

  const v = reduceDemo(DEMO_EVENTS, step);
  const assignee = ACTORS[v.assignee];

  return (
    <section className="pub-demo" aria-label="Product demo">
      <div className="pub-window" data-scene={v.scene}>
        <div className="pub-window__bar">
          <span className="pub-mono">{v.scene === 'task' ? 'Tasks / TAI-142' : 'Threads / Release week'}</span>
        </div>
        {v.scene === 'task' ? (
          <div className="pub-window__body">
            <h3>{TASK_TITLE}</h3>
            <div className="pub-meta">
              <span className={`pub-status pub-status--${v.status}`}>{STATUS_LABEL[v.status]}</span>
              <span>Assigned to <strong>{assignee.name}</strong></span>
              {v.prUrl && <a className="pub-pr" href="#demo" onClick={(e) => e.preventDefault()}>PR · {PR_URL}</a>}
              {v.approved && <span className="pub-approved">✓ Approved by Code reviewer</span>}
            </div>
            <ul className="pub-msgs">
              {v.comments.map((m, i) => <Bubble key={i} m={m} />)}
            </ul>
          </div>
        ) : (
          <div className="pub-window__body">
            <ul className="pub-msgs">
              {v.threadMessages.map((m, i) => <Bubble key={i} m={m} />)}
            </ul>
          </div>
        )}
      </div>

      <p className="pub-caption" aria-live="polite">{v.caption}</p>
      <div className="pub-controls" role="group" aria-label="Demo controls">
        <button type="button" aria-label="Previous step" disabled={step === 0}
          onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}><SkipBack size={16} /></button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => { if (step >= last) setStep(0); setPlaying((p) => !p); }}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" aria-label="Next step" disabled={step === last}
          onClick={() => { setPlaying(false); setStep((s) => Math.min(last, s + 1)); }}><SkipForward size={16} /></button>
        <button type="button" aria-label="Replay from start"
          onClick={() => { setStep(0); setPlaying(!reduced); }}><RotateCcw size={16} /></button>
        <button type="button" className="pub-skip" onClick={() => { setPlaying(false); setStep(last); }}>Skip to end</button>
        <span className="pub-mono pub-count">{step + 1}/{DEMO_EVENTS.length}</span>
      </div>
      <p className="pub-note">Illustrative walkthrough, not a live recording.</p>
    </section>
  );
}
