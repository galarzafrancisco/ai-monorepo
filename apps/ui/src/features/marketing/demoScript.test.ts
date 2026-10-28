import { describe, expect, it } from 'vitest';
import { DEMO_EVENTS, HERO_ID, reduceDemo, stepDuration } from './demoScript';

describe('demo script', () => {
  it('starts with the new task queued on a board that already has work on it', () => {
    const v = reduceDemo(DEMO_EVENTS, 0);
    expect(v.scene).toBe('board');
    expect(v.hero?.status).toBe('NOT_STARTED');
    expect(v.tasks.length).toBeGreaterThan(1);
    expect(v.tasks.filter((t) => t.id === HERO_ID)).toHaveLength(1);
  });
  it('is sent back to Queued by the reviewer before approval', () => {
    const i = DEMO_EVENTS.findIndex((e, n) => n > 3 && e.type === 'status' && e.status === 'NOT_STARTED');
    const v = reduceDemo(DEMO_EVENTS, i);
    expect(v.hero?.status).toBe('NOT_STARTED');
    expect(v.prUrl).not.toBeNull();
    expect(v.approved).toBe(false);
    expect(v.comments.at(-1)?.by).toBe('code-reviewer');
  });
  it('keeps the card counters in step with the activity', () => {
    const v = reduceDemo(DEMO_EVENTS, DEMO_EVENTS.findIndex((e) => e.type === 'approve'));
    expect(v.hero?.comments).toBe(v.comments.length);
    expect(v.hero?.pr?.number).toBeDefined();
  });
  it('walks the pull request from open, through CI, to merged', () => {
    const prs = DEMO_EVENTS.map((_, i) => reduceDemo(DEMO_EVENTS, i).hero?.pr);
    const first = prs.findIndex(Boolean);
    expect(prs[first]).toMatchObject({ state: 'open', checks: 'none' });
    const pending = prs.findIndex((p) => p?.checks === 'pending');
    const green = prs.findIndex((p, i) => i > pending && p?.checks === 'success');
    const merged = prs.findIndex((p) => p?.state === 'merged');
    expect(first).toBeLessThan(pending);
    expect(pending).toBeLessThan(green);
    expect(green).toBeLessThan(merged);
    expect(prs.slice(first, merged).every((p) => p?.state === 'open')).toBe(true);
    expect(prs.at(-1)?.state).toBe('merged');
  });
  it('merges a background pull request when its task ships', () => {
    const pg = (n: number) => reduceDemo(DEMO_EVENTS, n).tasks.find((t) => t.id === 'c2f7a9')!;
    expect(pg(0).pr?.state).toBe('open');
    expect(pg(DEMO_EVENTS.length - 1)).toMatchObject({ status: 'DONE', pr: { state: 'merged' } });
  });
  it('moves background tasks too, so the board feels alive', () => {
    const before = reduceDemo(DEMO_EVENTS, 0).tasks.filter((t) => t.id !== HERO_ID);
    const after = reduceDemo(DEMO_EVENTS, DEMO_EVENTS.length - 1).tasks.filter((t) => t.id !== HERO_ID);
    expect(after.some((t, i) => t.status !== before[i].status)).toBe(true);
  });
  it('shows a building task asking for help, then unblocked once it moves on', () => {
    const qa = (n: number) => reduceDemo(DEMO_EVENTS, n).tasks.find((t) => t.id === '5e8a13')!;
    expect(qa(0)).toMatchObject({ status: 'IN_PROGRESS', questions: 1 });
    expect(qa(DEMO_EVENTS.length - 1)).toMatchObject({ status: 'FOR_REVIEW', questions: 0 });
  });
  it('ends in a thread with a shipped task and a reminder', () => {
    const v = reduceDemo(DEMO_EVENTS, DEMO_EVENTS.length - 1);
    expect(v.approved).toBe(true);
    expect(v.hero?.status).toBe('DONE');
    expect(v.scene).toBe('thread');
    expect(v.threadMessages.at(-1)?.reminder).toBeDefined();
  });
  it('gives longer messages more time on screen', () => {
    const durations = DEMO_EVENTS.map(stepDuration);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(2200);
    const comment = DEMO_EVENTS.find((e) => e.type === 'comment' && e.message.by === 'code-reviewer')!;
    const plain = DEMO_EVENTS.find((e) => e.type === 'status')!;
    expect(stepDuration(comment)).toBeGreaterThan(stepDuration(plain));
  });
});
