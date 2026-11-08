// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftScopeContext, removeUnscopedDrafts } from '../context/DraftScopeContext';
import { useDraftState } from './useDraftState';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

function inScope(scope: string | null) {
  return ({ children }: { children: ReactNode }) => (
    <DraftScopeContext.Provider value={scope}>{children}</DraftScopeContext.Provider>
  );
}

function renderDraft(scope: string | null) {
  return renderHook(() => useDraftState({ key: 'new-task-draft', defaultValue: '' }), {
    wrapper: inScope(scope),
  });
}

describe('useDraftState', () => {
  it("keeps workspace A's draft out of workspace B and brings it back in A", () => {
    vi.useFakeTimers();
    const inA = renderDraft('person-1:ws-a');
    act(() => inA.result.current[1]('confidential A plan'));
    act(() => vi.advanceTimersByTime(600));
    inA.unmount();

    // Reload in workspace B: the composer is empty.
    const inB = renderDraft('person-1:ws-b');
    expect(inB.result.current[0]).toBe('');
    inB.unmount();

    // Another person in workspace A doesn't get it either.
    const otherPerson = renderDraft('person-2:ws-a');
    expect(otherPerson.result.current[0]).toBe('');
    otherPerson.unmount();

    // Back in A, the draft is there.
    const backInA = renderDraft('person-1:ws-a');
    expect(backInA.result.current[0]).toBe('confidential A plan');
  });

  it('neither loads nor saves until the scope is known', () => {
    vi.useFakeTimers();
    localStorage.setItem('new-task-draft', JSON.stringify('legacy unscoped draft'));
    const unscoped = renderDraft(null);
    expect(unscoped.result.current[0]).toBe('');
    act(() => unscoped.result.current[1]('typed early'));
    act(() => vi.advanceTimersByTime(600));
    expect(Object.keys(localStorage).filter((k) => k.startsWith('draft:'))).toEqual([]);
  });

  it('loads the draft once the scope resolves', () => {
    localStorage.setItem('draft:person-1:ws-a:new-task-draft', JSON.stringify('saved'));
    let scope: string | null = null;
    const { result, rerender } = renderHook(
      () => useDraftState({ key: 'new-task-draft', defaultValue: '' }),
      { wrapper: ({ children }) => <DraftScopeContext.Provider value={scope}>{children}</DraftScopeContext.Provider> },
    );
    expect(result.current[0]).toBe('');
    scope = 'person-1:ws-a';
    rerender();
    expect(result.current[0]).toBe('saved');
  });
});

describe('removeUnscopedDrafts', () => {
  it('deletes drafts from before scoping and keeps everything else', () => {
    localStorage.setItem('new-task-draft', '"a"');
    localStorage.setItem('thread-chat-draft-new', '"b"');
    localStorage.setItem('new-comment-draft-task-1', '"c"');
    localStorage.setItem('draft:person-1:ws-a:new-task-draft', '"kept"');
    localStorage.setItem('theme', 'dark');

    removeUnscopedDrafts();

    expect(Object.keys(localStorage).sort()).toEqual(['draft:person-1:ws-a:new-task-draft', 'theme']);
  });
});
