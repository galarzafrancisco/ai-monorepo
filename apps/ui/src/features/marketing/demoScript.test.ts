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
    expect(v.hero?.artefacts).toBe(1);
  });
  it('moves background tasks too, so the board feels alive', () => {
    const before = reduceDemo(DEMO_EVENTS, 0).tasks.filter((t) => t.id !== HERO_ID);
    const after = reduceDemo(DEMO_EVENTS, DEMO_EVENTS.length - 1).tasks.filter((t) => t.id !== HERO_ID);
    expect(after.some((t, i) => t.status !== before[i].status)).toBe(true);
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
