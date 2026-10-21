import { useEffect, useRef } from "react";
import { Button, Text } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import "./ThreadListLoadMore.css";

/**
 * Goes at the end of a thread list. Loads the next page of older threads when
 * it scrolls into view, and shows a spinner while they are on their way.
 *
 * Renders nothing once every thread is loaded.
 */
export function ThreadListLoadMore() {
  const { hasMoreThreads, isLoadingMore, loadMoreError, loadMoreThreads } = useThreadsCtx();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // After a failure the user retries with the button, so a broken server is
  // not asked again on every render.
  const shouldWatch = hasMoreThreads && !isLoadingMore && !loadMoreError;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!shouldWatch || !sentinel || typeof IntersectionObserver === "undefined") return;

    // Set up again after each page: a new observer reports straight away, so a
    // list still too short to scroll keeps loading until it fills the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreThreads();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [shouldWatch, loadMoreThreads]);

  if (!hasMoreThreads) return null;

  return (
    <div ref={sentinelRef} className="thread-list-load-more">
      {isLoadingMore ? (
        <div className="thread-list-load-more__status" role="status" aria-live="polite">
          <span className="thread-list-load-more__spinner" aria-hidden="true" />
          <Text size="1" tone="muted">Loading more threads...</Text>
        </div>
      ) : (
        <>
          {loadMoreError ? (
            <Text size="1" tone="muted">Could not load more threads.</Text>
          ) : null}
          <Button variant="secondary" onClick={() => void loadMoreThreads()}>
            {loadMoreError ? "Try again" : "Show more"}
          </Button>
        </>
      )}
    </div>
  );
}
