import { useCallback, useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';

/** How far above the top edge (px) the reader can be before older items start loading. */
const PRELOAD_MARGIN_PX = 240;

interface UseLoadEarlierOptions {
  /** The scrolling list. Older items are added at its top. */
  containerRef: RefObject<HTMLElement | null>;
  hasMore: boolean;
  isLoading: boolean;
  load: () => void | Promise<unknown>;
  /** Changes when the list's items change, so the reading position can be restored. */
  contentDeps: DependencyList;
  /** Called after the position is restored, e.g. to stop a chat from jumping to the bottom. */
  onRestored?: () => void;
}

/**
 * Loads older items when the reader scrolls near the top of a list, and keeps
 * what they were reading in place as those items appear above it. Pair it with
 * <LoadEarlier>, which renders the sentinel and a button for when scrolling
 * alone doesn't reach (e.g. the list doesn't overflow yet).
 */
export function useLoadEarlier({ containerRef, hasMore, isLoading, load, contentDeps, onRestored }: UseLoadEarlierOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const heightBeforeLoad = useRef<number | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;

  const loadEarlier = useCallback(() => {
    if (!hasMore || isLoading || heightBeforeLoad.current !== null) return;
    heightBeforeLoad.current = containerRef.current?.scrollHeight ?? null;
    void loadRef.current();
  }, [containerRef, hasMore, isLoading]);

  // Scrolling near the top loads the next page. Only while the list overflows:
  // otherwise the sentinel is always in view and would load every page at once.
  useEffect(() => {
    const container = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel || !hasMore || isLoading || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && container.scrollHeight > container.clientHeight) loadEarlier();
      },
      { root: container, rootMargin: `${PRELOAD_MARGIN_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [containerRef, hasMore, isLoading, loadEarlier]);

  // Older items went in above: move down by the height they added so nothing on screen moves.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const previousHeight = heightBeforeLoad.current;
    if (!container || previousHeight === null || isLoading) return;
    heightBeforeLoad.current = null;
    const added = container.scrollHeight - previousHeight;
    if (added > 0) {
      container.scrollTop += added;
      onRestoredRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...contentDeps, isLoading]);

  return { sentinelRef, loadEarlier };
}
