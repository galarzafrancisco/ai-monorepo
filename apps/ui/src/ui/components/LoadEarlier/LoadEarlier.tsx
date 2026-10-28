import type { RefObject } from 'react';
import './LoadEarlier.css';

export interface LoadEarlierProps {
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  isLoading: boolean;
  onLoad: () => void;
  /** What's being loaded, e.g. "messages" or "events". */
  noun: string;
}

/**
 * Top of a list whose older items load as you scroll up (see useLoadEarlier).
 * Shows a quiet loading line while fetching, and a button as the fallback.
 */
export function LoadEarlier({ sentinelRef, hasMore, isLoading, onLoad, noun }: LoadEarlierProps) {
  if (!hasMore) return null;
  return (
    <div className="load-earlier" ref={sentinelRef}>
      {isLoading ? (
        <span className="load-earlier__loading" role="status">
          <span className="load-earlier__spinner" aria-hidden="true" />
          Loading earlier {noun}…
        </span>
      ) : (
        <button type="button" className="load-earlier__button" onClick={onLoad}>
          Load earlier {noun}
        </button>
      )}
    </div>
  );
}
