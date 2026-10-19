import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** How close to the bottom (px) still counts as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 80;

interface UseChatScrollFollowOptions {
  containerRef: RefObject<HTMLElement | null>;
  endRef: RefObject<HTMLElement | null>;
  /** Changes to these values mean "something new to look at". */
  followDeps: unknown[];
  /** Id of the newest message; a change means a real new message arrived. */
  lastMessageId: string | null;
  /** True when the newest message was written by the current user. */
  lastMessageIsOwn: boolean;
  /** Resets the state when the chat switches to another thread. */
  resetKey: string;
  /** False while the scroll container isn't rendered yet (e.g. loading). */
  enabled: boolean;
  /** Set when the change was not a new item at the bottom (e.g. older messages loaded). */
  skipNextFollowRef: RefObject<boolean>;
}

/**
 * Keeps a chat pinned to the bottom while the reader is there, and leaves them
 * alone when they have scrolled up to read something older.
 *
 * - At the bottom: every update (messages, thinking, tool calls, streaming) follows.
 * - Scrolled up: nothing moves. A real new message raises `hasNewMessages`, so the
 *   chat can offer a "jump to latest" button. Thinking / tool calls / streaming don't.
 * - The reader's own message always brings them to the bottom.
 */
export function useChatScrollFollow({
  containerRef,
  endRef,
  followDeps,
  lastMessageId,
  lastMessageIsOwn,
  resetKey,
  enabled,
  skipNextFollowRef,
}: UseChatScrollFollowOptions) {
  const pinnedRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(lastMessageId);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const setPinned = useCallback((pinned: boolean) => {
    pinnedRef.current = pinned;
    if (pinned) setHasNewMessages(false);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      setPinned(true);
      endRef.current?.scrollIntoView({ behavior });
    },
    [endRef, setPinned],
  );

  // A new thread starts at the bottom.
  useEffect(() => {
    setPinned(true);
    lastMessageIdRef.current = null;
  }, [resetKey, setPinned]);

  // Track whether the reader is at the bottom.
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    lastScrollTopRef.current = container.scrollTop;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom <= AT_BOTTOM_THRESHOLD_PX) {
        if (!pinnedRef.current) setPinned(true);
      } else if (scrollTop < lastScrollTopRef.current && pinnedRef.current) {
        // Only an upward scroll unpins. A smooth scroll on its way down
        // passes through "not at the bottom" and must not unpin.
        setPinned(false);
      }
      lastScrollTopRef.current = scrollTop;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef, setPinned, resetKey, enabled]);

  useEffect(() => {
    const isNewMessage = lastMessageId !== null && lastMessageId !== lastMessageIdRef.current;
    lastMessageIdRef.current = lastMessageId;

    if (skipNextFollowRef.current) {
      skipNextFollowRef.current = false;
      return;
    }

    if (pinnedRef.current || (isNewMessage && lastMessageIsOwn)) {
      scrollToBottom();
      return;
    }

    if (isNewMessage) setHasNewMessages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, followDeps);

  return { hasNewMessages, scrollToBottom };
}
