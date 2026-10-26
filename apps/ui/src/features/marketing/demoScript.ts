/**
 * The product demo is data: an ordered list of events. The Demo component
 * reduces events [0..n] into a view state, so playback, pause, stepping and
 * reduced-motion all share one source of truth. Illustrative content only.
 */
import { TaskStatus } from '../../shared/const/taskStatus';

export { TaskStatus };
export type ActorId = 'jane' | 'claude-dev' | 'code-reviewer' | 'planner' | 'qa' | 'taico';

/** Avatars are the bundled ones agents can pick in the app (apps/ui/public/avatar). */
export const ACTORS: Record<ActorId, { name: string; handle: string; kind: 'human' | 'agent'; avatar?: string }> = {
  jane: { name: 'Jane', handle: 'jane', kind: 'human', avatar: '/avatar/grace.png' },
  'claude-dev': { name: 'Claude developer', handle: 'claude-dev', kind: 'agent', avatar: '/avatar/claude.webp' },
  'code-reviewer': { name: 'Code reviewer', handle: 'code-reviewer', kind: 'agent', avatar: '/avatar/openai.svg' },
  planner: { name: 'Planner', handle: 'planner', kind: 'agent', avatar: '/avatar/stacy.png' },
  qa: { name: 'QA agent', handle: 'qa', kind: 'agent', avatar: '/avatar/angus.png' },
  taico: { name: 'Taico', handle: 'taico', kind: 'agent', avatar: '/avatar/taico.png' },
};

export interface Message {
  by: ActorId;
  text: string;
  /** Rendered as a reminder confirmation card. */
  reminder?: { title: string; when: string };
}

export interface BoardTask {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assignee: ActorId;
  comments: number;
  artefacts: number;
  /** Open questions the assignee is waiting on a person to answer. */
  questions?: number;
}

/** The task the demo follows. The rest of the board is background life. */
export const HERO_ID = 'a41c92';
export const PR_URL = 'github.com/acme/api/pull/412';

type SideMove = { id: string; status: TaskStatus; assignee?: ActorId; questions?: number };

export type DemoEvent = { caption: string; side?: SideMove } & (
  | { type: 'create' }
  | { type: 'status'; status: TaskStatus; assignee?: ActorId }
  | { type: 'comment'; message: Message }
  | { type: 'pr' }
  | { type: 'approve'; message: Message }
  | { type: 'thread-message'; message: Message }
);

const BACKGROUND: BoardTask[] = [
  { id: '7c01de', name: 'Spike: SSO with Okta', description: 'Do we need SAML, or is OIDC enough?', status: 'NOT_STARTED', assignee: 'jane', comments: 2, artefacts: 0 },
  { id: '19bb40', name: 'Plan the v2 migration', description: 'Split the auth and pagination changes into tasks', status: 'NOT_STARTED', assignee: 'planner', comments: 0, artefacts: 0 },
  { id: '5e8a13', name: 'Fix flaky checkout e2e', description: 'Cart total races the price fetch', status: 'IN_PROGRESS', assignee: 'qa', comments: 3, artefacts: 1, questions: 1 },
  { id: 'c2f7a9', name: 'Bump Postgres to 16', description: 'Staging is green, needs a final look', status: 'FOR_REVIEW', assignee: 'code-reviewer', comments: 4, artefacts: 1 },
  { id: '0d44e1', name: 'Drop the legacy /v1 auth', description: 'Last client migrated on Friday', status: 'DONE', assignee: 'claude-dev', comments: 6, artefacts: 2 },
];

export const HERO_TASK: BoardTask = {
  id: HERO_ID, name: 'Rate limit the /export endpoint', description: 'One customer is hammering it. 100 req/min per client.',
  status: 'NOT_STARTED', assignee: 'claude-dev', comments: 0, artefacts: 0,
};

export const DEMO_EVENTS: DemoEvent[] = [
  { type: 'create', caption: 'You write a task and assign it to your developer agent.' },
  { type: 'status', status: 'IN_PROGRESS', caption: 'It picks the task up. The card moves to Building.',
    side: { id: '19bb40', status: 'IN_PROGRESS' } },
  { type: 'comment', caption: 'Progress lands on the task, not in a terminal you have to go find.',
    message: { by: 'claude-dev', text: 'On branch feature/export-rate-limit. Adding a token bucket in front of /export.' } },
  { type: 'pr', caption: 'The pull request is linked to the task.',
    side: { id: 'c2f7a9', status: 'DONE' } },
  { type: 'status', status: 'FOR_REVIEW', assignee: 'code-reviewer', caption: 'When it’s ready, a reviewer agent takes it.' },
  { type: 'comment', caption: 'The reviewer leaves real feedback…',
    message: { by: 'code-reviewer', text: 'The bucket is keyed by IP. Behind the load balancer that’s everyone, so one noisy client throttles all of them. Key it by API token. Also missing: a test for the Retry-After header.' } },
  { type: 'status', status: 'NOT_STARTED', assignee: 'claude-dev', caption: '…and sends it back. You didn’t copy-paste a thing.' },
  { type: 'status', status: 'IN_PROGRESS', caption: 'The developer picks it up again, with the review right there on the task.' },
  { type: 'comment', caption: 'It fixes both and pushes to the same PR.',
    message: { by: 'claude-dev', text: 'Keyed by API token now, and added a Retry-After test. Pushed to the same PR.' },
    side: { id: '5e8a13', status: 'FOR_REVIEW', assignee: 'code-reviewer', questions: 0 } },
  { type: 'status', status: 'FOR_REVIEW', assignee: 'code-reviewer', caption: 'Back to review.' },
  { type: 'approve', caption: 'Approved. It ships, and the whole trail stays on the task.',
    message: { by: 'code-reviewer', text: 'Both fixed. Approved.' } },
  { type: 'thread-message', caption: 'Days later, in a thread, you ask what happened.',
    message: { by: 'jane', text: 'What happened with the export rate limit?' } },
  { type: 'thread-message', caption: 'Taico answers from the task and its history.',
    message: { by: 'taico', text: 'It shipped in PR #412: a token bucket on /export, 100 req/min. Review caught that it was keyed by IP, which behind the load balancer would have throttled everyone. It’s keyed by API token now, with a Retry-After test.' } },
  { type: 'thread-message', caption: 'You hand off the follow-up.',
    message: { by: 'jane', text: 'Nice. Remind me to tell the customer on Tuesday morning.' } },
  { type: 'thread-message', caption: 'It’s scheduled, and you can see it.',
    message: { by: 'taico', text: 'Done. I’ll ping you here.', reminder: { title: 'Tell the customer /export is rate limited', when: 'Tue 09:00' } } },
];

export interface DemoView {
  scene: 'board' | 'thread';
  tasks: BoardTask[];
  hero: BoardTask | null;
  comments: Message[];
  prUrl: string | null;
  approved: boolean;
  threadMessages: Message[];
  caption: string;
  /** Task ids touched by the latest step, for the update pulse. */
  touched: string[];
}

export function reduceDemo(events: DemoEvent[], upTo: number): DemoView {
  let tasks = BACKGROUND.map((t) => ({ ...t }));
  let hero: BoardTask | null = null;
  const view: Omit<DemoView, 'tasks' | 'hero'> = {
    scene: 'board', comments: [], prUrl: null, approved: false, threadMessages: [], caption: '', touched: [],
  };
  const patchHero = (p: Partial<BoardTask>) => { if (hero) hero = { ...hero, ...p }; };

  for (let i = 0; i <= upTo && i < events.length; i++) {
    const e = events[i];
    view.caption = e.caption;
    view.touched = [HERO_ID];
    switch (e.type) {
      case 'create': hero = { ...HERO_TASK }; break;
      case 'status': patchHero({ status: e.status, ...(e.assignee && { assignee: e.assignee }) }); break;
      case 'comment':
        view.comments = [...view.comments, e.message];
        patchHero({ comments: view.comments.length });
        break;
      case 'pr': view.prUrl = PR_URL; patchHero({ artefacts: 1 }); break;
      case 'approve':
        view.approved = true;
        view.comments = [...view.comments, e.message];
        patchHero({ status: 'DONE', comments: view.comments.length });
        break;
      case 'thread-message':
        view.scene = 'thread';
        view.threadMessages = [...view.threadMessages, e.message];
        view.touched = [];
        break;
    }
    if (e.side) {
      const s = e.side;
      tasks = tasks.map((t) => (t.id === s.id ? { ...t, status: s.status, ...(s.assignee && { assignee: s.assignee }), ...(s.questions !== undefined && { questions: s.questions }) } : t));
      view.touched = [...view.touched, s.id];
    }
  }
  return { ...view, tasks: hero ? [hero, ...tasks] : tasks, hero };
}

/** How long a step stays on screen: long enough to read what it adds. */
export function stepDuration(e: DemoEvent): number {
  const text = 'message' in e ? e.message.text.length : 0;
  return Math.min(6500, 2200 + e.caption.length * 12 + text * 28);
}
