import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Avatar, BoardCard } from '../../ui/primitives';
import { MAIN_NAVEGATION_ITEMS } from '../../shared/const/mainNavegationItems';
import { TASKS_STATUS } from '../../shared/const/taskStatus';
import { NavigationIcon } from '../../shared/components/NavigationIcon';
import { getTaskStatusTag } from '../tasks/taskStatusTag';
import { ACTORS, DEMO_EVENTS, HERO_ID, reduceDemo, stepDuration } from './demoScript';
import type { BoardTask, Message, TaskStatus } from './demoScript';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const COLUMNS = Object.keys(TASKS_STATUS) as TaskStatus[];
const SIDEBAR = MAIN_NAVEGATION_ITEMS.filter((i) => i.path !== '/logout');

/** Reveals text a few characters at a time, like a streamed agent reply. */
function Streaming({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => Math.min(text.length, c + 2)), 16);
    return () => clearInterval(t);
  }, [text]);
  return <>{text.slice(0, n)}</>;
}

function Typed({ text, animate }: { text: string; animate: boolean }) {
  return animate ? <Streaming key={text} text={text} /> : <>{text}</>;
}

function DemoCard({ task, pulse, animate, when }: { task: BoardTask; pulse?: number; animate: boolean; when?: string }) {
  const a = ACTORS[task.assignee];
  const tags = [];
  if (task.comments) tags.push({ label: `💬 ${task.comments}` });
  if (task.artefacts) tags.push({ label: `🔗 ${task.artefacts}` });
  return (
    <BoardCard
      className={task.id === HERO_ID ? 'pub-demo-card--hero' : ''}
      animation={animate ? 'entering' : undefined}
      pulseKey={pulse}
      leading={<Avatar name={a.name} src={a.avatar} size="md" />}
      topRight={when ?? (task.id === HERO_ID ? 'just now' : '2h ago')}
      tags={tags}
      footer={
        <>
          <span className="row-detail truncate">#{task.id}</span>
          <span className="row-detail truncate">@{a.handle}</span>
        </>
      }
    >
      <div className="row-title truncate">{task.name}</div>
      <div className="row-subtitle truncate">{task.description}</div>
    </BoardCard>
  );
}

function Comment({ m, latest, animate }: { m: Message; latest: boolean; animate: boolean }) {
  const a = ACTORS[m.by];
  return (
    <li className="pub-update">
      <Avatar name={a.name} src={a.avatar} size="sm" />
      <div className="pub-update__body">
        <div className="pub-update__who">{a.name} <span>@{a.handle}</span></div>
        <p><Typed text={m.text} animate={latest && animate} /></p>
      </div>
    </li>
  );
}

function ChatMessage({ m, latest, animate }: { m: Message; latest: boolean; animate: boolean }) {
  const a = ACTORS[m.by];
  const mine = a.kind === 'human';
  return (
    <li className={`pub-chat__msg${mine ? ' pub-chat__msg--mine' : ''}`}>
      <div className="pub-chat__who"><Avatar name={a.name} src={a.avatar} size="xs" /> {a.name}</div>
      <p><Typed text={m.text} animate={latest && animate && !mine} /></p>
      {m.reminder && (
        <div className="pub-reminder">
          <CalendarClock size={16} aria-hidden="true" />
          <div>
            <strong>Reminder scheduled</strong>
            <span>{m.reminder.title}</span>
          </div>
          <span className="pub-mono">{m.reminder.when}</span>
        </div>
      )}
    </li>
  );
}

export function Demo() {
  const last = DEMO_EVENTS.length - 1;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  // Autoplay once the demo scrolls into view, unless the visitor prefers reduced motion.
  const [wantPlay, setWantPlay] = useState(false);
  const [seen, setSeen] = useState(false);
  const playing = wantPlay && step < last;
  const animate = !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); if (!reduced) setWantPlay(true); }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, reduced]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setStep((s) => s + 1), stepDuration(DEMO_EVENTS[step]));
    return () => clearTimeout(t);
  }, [playing, step]);

  const v = reduceDemo(DEMO_EVENTS, step);
  const prev = step > 0 ? reduceDemo(DEMO_EVENTS, step - 1) : null;
  // Cards replay their enter animation only when they land in a new column.
  const moved = (t: BoardTask) => animate && v.touched.includes(t.id) && prev?.tasks.find((p) => p.id === t.id)?.status !== t.status;
  const heroStatus = v.hero?.status;
  const goTo = (s: number) => { setWantPlay(false); setStep(Math.max(0, Math.min(last, s))); };

  return (
    <section ref={ref} className="pub-demo" id="demo" aria-label="Product demo">
      <div className="pub-window" data-scene={v.scene}>
        <div className="pub-window__bar" aria-hidden="true">
          <span className="pub-window__dots"><i /><i /><i /></span>
          <span className="pub-mono">taico.app/{v.scene === 'board' ? 'tasks' : 'threads/release-week'}</span>
        </div>
        <div className="pub-window__app">
          <nav className="pub-mini-nav" aria-hidden="true">
            {SIDEBAR.map((i) => (
              <span key={i.path} className={(v.scene === 'board' ? i.path === '/tasks' : i.path === '/threads') ? 'is-on' : ''}>
                <NavigationIcon icon={i.icon} className="" size={18} />
              </span>
            ))}
          </nav>

          {v.scene === 'board' ? (
            <div className="pub-scene pub-scene--board">
              <div className="pub-board__tabs" aria-hidden="true">
                {COLUMNS.map((c) => <span key={c} className={heroStatus === c ? 'is-on' : ''}>{TASKS_STATUS[c].label}</span>)}
              </div>
              <div className="pub-board" data-focus={heroStatus ?? 'NOT_STARTED'}>
                {COLUMNS.map((c) => {
                  const cards = v.tasks.filter((t) => t.status === c);
                  return (
                    <div key={c} className={`pub-col${heroStatus === c ? ' is-focus' : ''}`}>
                      <div className="pub-col__head"><span>{TASKS_STATUS[c].label}</span><span>{cards.length}</span></div>
                      <div className="pub-col__body">
                        {cards.map((t) => (
                          <DemoCard key={`${t.id}-${t.status}`} task={t} animate={moved(t)}
                            pulse={v.touched.includes(t.id) ? step : undefined} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <aside className="pub-panel">
                <div className="pub-panel__head">
                  <span className="pub-mono">#{HERO_ID}</span>
                  {v.hero && (() => { const tag = getTaskStatusTag(v.hero.status); return <span className={`chip chip--${tag.color}`}>{tag.label}</span>; })()}
                </div>
                <h3>{v.hero?.name ?? 'New task'}</h3>
                {v.prUrl && <span className="pub-pr pub-mono">🔗 {v.prUrl}</span>}
                <p className="pub-panel__label">Updates</p>
                <ul className="pub-updates">
                  {v.comments.length === 0 && <li className="pub-updates__empty">Live activity will show here</li>}
                  {v.comments.map((m, i) => (
                    <Comment key={i} m={m} latest={i === v.comments.length - 1 && DEMO_EVENTS[step].type !== 'status'} animate={animate} />
                  ))}
                </ul>
              </aside>
            </div>
          ) : (
            <div className="pub-scene pub-scene--thread">
              <div className="pub-thread__main">
                <h3 className="pub-thread__title">Release week</h3>
                <ul className="pub-chat">
                  {v.threadMessages.map((m, i) => (
                    <ChatMessage key={i} m={m} latest={i === v.threadMessages.length - 1} animate={animate} />
                  ))}
                </ul>
              </div>
              {v.hero && (
                <aside className="pub-panel">
                  <p className="pub-panel__label">Tasks in this thread</p>
                  <DemoCard task={v.hero} animate={false} when="3d ago" />
                </aside>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="pub-caption" aria-live="polite">{v.caption}</p>
      <div className="pub-controls" role="group" aria-label="Demo controls">
        <button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => goTo(step - 1)}><SkipBack size={16} /></button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => { if (step >= last) setStep(0); setWantPlay(!playing); }}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" aria-label="Next step" disabled={step === last} onClick={() => goTo(step + 1)}><SkipForward size={16} /></button>
        <div className="pub-scrub">
          {DEMO_EVENTS.map((e, i) => (
            <button key={i} type="button" aria-label={`Step ${i + 1}: ${e.caption}`} aria-current={i === step}
              className={`pub-scrub__seg${i < step ? ' is-done' : ''}${i === step ? ' is-on' : ''}${i === step && playing ? ' is-playing' : ''}`}
              style={i === step && playing ? { animationDuration: `${stepDuration(e)}ms` } : undefined}
              onClick={() => goTo(i)} />
          ))}
        </div>
        <button type="button" aria-label="Replay from start" onClick={() => { setStep(0); setWantPlay(true); }}><RotateCcw size={16} /></button>
      </div>
      <p className="pub-note">Illustrative walkthrough built from Taico’s own UI components, not a screen recording.</p>
    </section>
  );
}
