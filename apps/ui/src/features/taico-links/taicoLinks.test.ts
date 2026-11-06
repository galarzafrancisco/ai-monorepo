import { describe, expect, it } from 'vitest';
import { parseTaicoUrl, taicoFallbackLabel, taicoRouteOf } from './taicoLinks';

const origin = 'https://taico.example.com';
const id = '4df0166d-14ed-4e17-a1e4-8772cf6b6d53';

describe('parseTaicoUrl', () => {
  it('reads links to tasks and context blocks on this Taico', () => {
    expect(parseTaicoUrl(`${origin}/tasks/task/${id}`, origin)).toEqual({ kind: 'task', id });
    expect(parseTaicoUrl(`${origin}/context/block/${id}`, origin)).toEqual({ kind: 'block', id });
    expect(parseTaicoUrl(`${origin}/tasks/task/${id}/?tab=1#comment-2`, origin)).toEqual({ kind: 'task', id });
  });

  it('reads paths, as in markdown links', () => {
    expect(parseTaicoUrl(`/tasks/task/${id}`, origin)).toEqual({ kind: 'task', id });
    expect(parseTaicoUrl(`/context/block/${id}`, origin)).toEqual({ kind: 'block', id });
  });

  it('leaves out other hosts, other pages and made-up schemes', () => {
    expect(parseTaicoUrl(`https://other.example.com/tasks/task/${id}`, origin)).toBeNull();
    expect(parseTaicoUrl(`${origin}/context/block/${id}/edit`, origin)).toBeNull();
    expect(parseTaicoUrl(`${origin}/tasks/in-progress`, origin)).toBeNull();
    expect(parseTaicoUrl(`context://${id}`, origin)).toBeNull();
    expect(parseTaicoUrl(`tasks/task/${id}`, origin)).toBeNull();
    expect(parseTaicoUrl('https://github.com/acme/api/pull/1', origin)).toBeNull();
  });
});

describe('taicoRouteOf', () => {
  it('keeps the path, query and anchor', () => {
    expect(taicoRouteOf(`${origin}/tasks/task/${id}?a=1#b`, origin)).toBe(`/tasks/task/${id}?a=1#b`);
  });
});

describe('taicoFallbackLabel', () => {
  it('names the kind and a short id', () => {
    expect(taicoFallbackLabel({ kind: 'task', id })).toBe('Task 4df0166d');
    expect(taicoFallbackLabel({ kind: 'block', id })).toBe('Block 4df0166d');
  });
});
