import { useEffect, useState } from 'react';
import { useThreadsCtx } from './ThreadsProvider';

const isPageVisible = () => document.visibilityState === 'visible';

/**
 * Marks a thread as read while the user is looking at it.
 *
 * "Looking at it" means the chat is on screen, its messages have loaded, and
 * the browser tab is visible. The thread is marked again each time a message
 * arrives, and when the user comes back to a hidden tab.
 */
export const useMarkThreadRead = (
  threadId: string,
  latestMessageId: string | null,
  isReady: boolean,
) => {
  const { markThreadRead, setViewingThreadId } = useThreadsCtx();
  const [isVisible, setIsVisible] = useState(isPageVisible);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(isPageVisible());
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const isViewing = isVisible && isReady;

  // Lets the thread list skip the unread badge for messages the user is watching arrive.
  useEffect(() => {
    if (!isViewing) return;
    setViewingThreadId(threadId);
    return () => setViewingThreadId(null);
  }, [threadId, isViewing, setViewingThreadId]);

  useEffect(() => {
    if (!isViewing) return;
    void markThreadRead(threadId);
  }, [threadId, latestMessageId, isViewing, markThreadRead]);
};
