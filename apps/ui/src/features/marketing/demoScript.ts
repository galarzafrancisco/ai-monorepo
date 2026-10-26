/**
 * The product demo is data: an ordered list of events. The Demo component
 * reduces events [0..n] into a view state, so playback, pause, stepping and
 * reduced-motion all share one source of truth. Illustrative content only.
 */
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
export type ActorId = 'fran' | 'claude-dev' | 'code-reviewer' | 'taico';

export const ACTORS: Record<ActorId, { name: string; kind: 'human' | 'agent' }> = {
  fran: { name: 'Fran', kind: 'human' },
  'claude-dev': { name: 'Claude developer', kind: 'agent' },
  'code-reviewer': { name: 'Code reviewer', kind: 'agent' },
  taico: { name: 'Taico', kind: 'agent' },
};

export interface Message {
  by: ActorId;
  text: string;
  /** Rendered as a reminder confirmation card. */
  reminder?: { title: string; when: string };
}

export type DemoEvent =
  | { caption: string; type: 'create' }
  | { caption: string; type: 'status'; status: TaskStatus; assignee?: ActorId }
  | { caption: string; type: 'comment'; message: Message }
  | { caption: string; type: 'pr'; url: string }
  | { caption: string; type: 'approve' }
  | { caption: string; type: 'thread-message'; message: Message };

export const TASK_TITLE = 'Rate limit the /export endpoint';
export const PR_URL = 'github.com/acme/api/pull/412';

export const DEMO_EVENTS: DemoEvent[] = [
  { type: 'create', caption: 'You create a task and assign it to an agent.' },
  { type: 'status', status: 'IN_PROGRESS', assignee: 'claude-dev', caption: 'Claude picks it up. Status moves to In progress.' },
  { type: 'comment', message: { by: 'claude-dev', text: 'Starting on branch feature/export-rate-limit. Adding a token bucket in front of /export.' }, caption: 'Progress shows up as comments on the task.' },
  { type: 'pr', url: PR_URL, caption: 'A pull request is linked to the task.' },
  { type: 'status', status: 'FOR_REVIEW', assignee: 'code-reviewer', caption: 'It goes to the code reviewer agent.' },
  { type: 'comment', message: { by: 'code-reviewer', text: 'The bucket is keyed by IP. Behind our proxy that is everyone, so one noisy client throttles all. Key by API token. Also: no test for the 429 Retry-After header.' }, caption: 'The reviewer leaves substantive feedback…' },
  { type: 'status', status: 'NOT_STARTED', assignee: 'claude-dev', caption: '…and sends it back to Not started.' },
  { type: 'status', status: 'IN_PROGRESS', assignee: 'claude-dev', caption: 'Claude picks it up again.' },
  { type: 'comment', message: { by: 'claude-dev', text: 'Keyed by API token now and added a Retry-After test. Pushed to the same PR.' }, caption: 'It addresses the feedback and updates the PR.' },
  { type: 'status', status: 'FOR_REVIEW', assignee: 'code-reviewer', caption: 'Back to review.' },
  { type: 'approve', caption: 'The reviewer approves.' },
  { type: 'thread-message', message: { by: 'fran', text: 'What got done on the export rate limit?' }, caption: 'Later, in a shared thread, you ask what happened.' },
  { type: 'thread-message', message: { by: 'taico', text: 'Claude added token-bucket rate limiting to /export in PR #412. The reviewer flagged IP-based keys and a missing Retry-After test; both were fixed and the PR is approved.' }, caption: 'The agent answers from the task and its history.' },
  { type: 'thread-message', message: { by: 'fran', text: 'Remind me to launch the marketing campaign.' }, caption: 'You hand it a reminder.' },
  { type: 'thread-message', message: { by: 'taico', text: 'Done. I’ll remind you in this thread.', reminder: { title: 'Launch the marketing campaign', when: 'Tue 27 Oct, 09:00' } }, caption: 'It is scheduled, and visible.' },
];

export interface DemoView {
  scene: 'task' | 'thread';
  status: TaskStatus;
  assignee: ActorId;
  comments: Message[];
  prUrl: string | null;
  approved: boolean;
  threadMessages: Message[];
  caption: string;
}

export function reduceDemo(events: DemoEvent[], upTo: number): DemoView {
  const view: DemoView = {
    scene: 'task', status: 'NOT_STARTED', assignee: 'claude-dev', comments: [],
    prUrl: null, approved: false, threadMessages: [], caption: '',
  };
  for (let i = 0; i <= upTo && i < events.length; i++) {
    const e = events[i];
    view.caption = e.caption;
    switch (e.type) {
      case 'status': view.status = e.status; if (e.assignee) view.assignee = e.assignee; break;
      case 'comment': view.comments = [...view.comments, e.message]; break;
      case 'pr': view.prUrl = e.url; break;
      case 'approve': view.approved = true; view.status = 'DONE'; break;
      case 'thread-message': view.scene = 'thread'; view.threadMessages = [...view.threadMessages, e.message]; break;
      case 'create': break;
    }
  }
  return view;
}
