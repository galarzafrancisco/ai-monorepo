import { describe, expect, it } from 'vitest';
import { DEMO_EVENTS, reduceDemo } from './demoScript';

describe('demo script', () => {
  it('starts as a not-started task', () => {
    const v = reduceDemo(DEMO_EVENTS, 0);
    expect(v.status).toBe('NOT_STARTED');
    expect(v.scene).toBe('task');
  });
  it('is sent back to NOT_STARTED by the reviewer before approval', () => {
    const i = DEMO_EVENTS.findIndex((e) => e.type === 'status' && e.status === 'NOT_STARTED' && e.assignee === 'claude-dev' && DEMO_EVENTS.indexOf(e) > 3);
    const v = reduceDemo(DEMO_EVENTS, i);
    expect(v.status).toBe('NOT_STARTED');
    expect(v.prUrl).not.toBeNull();
    expect(v.approved).toBe(false);
  });
  it('ends in a thread with an approved task and a reminder', () => {
    const v = reduceDemo(DEMO_EVENTS, DEMO_EVENTS.length - 1);
    expect(v.approved).toBe(true);
    expect(v.scene).toBe('thread');
    expect(v.threadMessages.at(-1)?.reminder).toBeDefined();
  });
});
