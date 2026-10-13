import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { IosShell } from "../../app/shells/IosShell";
import { Text } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import { UnreadBadge } from "./UnreadBadge";
import { ThreadListLoadMore } from "./ThreadListLoadMore";
import "./ThreadsLayout.css";

export function ThreadsLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { id: threadId } = useParams<{ id?: string }>();
  const isThreadDetailRoute = Boolean(threadId);
  const navigate = useNavigate();
  const { threads, totalThreads, isLoading, error, sectionTitle, navItems, optimisticDraftThread, refreshThreads } = useThreadsCtx();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const unreadMessageCount = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  // The list outlives this section. Threads created or deleted elsewhere send
  // no event to the list, so catch up each time the user comes back to it.
  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    if (!isDesktop) return;
    const stored = localStorage.getItem("threads-sidebar-collapsed");
    setIsSidebarCollapsed(stored === "true");
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
    localStorage.setItem("threads-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isDesktop, isSidebarCollapsed]);

  if (isDesktop) {
    return (
      <div className="threads-layout threads-layout--desktop">
        <aside className={`threads-layout__sidebar ${isSidebarCollapsed ? "threads-layout__sidebar--collapsed" : ""}`}>
          <div className="threads-layout__sidebar-header">
            {!isSidebarCollapsed ? (
              <>
                <button
                  type="button"
                  className="threads-layout__sidebar-title"
                  onClick={() => navigate("/threads")}
                >
                  <Text as="span" size="2" weight="semibold">Threads</Text>
                </button>
                <div className="threads-layout__sidebar-header-actions">
                  <Text as="div" size="1" tone="muted">{totalThreads}</Text>
                  <button
                    type="button"
                    className="threads-layout__sidebar-new"
                    onClick={() => navigate("/threads")}
                    aria-label="New thread"
                    title="New thread"
                  >
                    +
                  </button>
                </div>
              </>
            ) : unreadMessageCount > 0 ? (
              <UnreadBadge count={unreadMessageCount} />
            ) : (
              <Text as="div" size="1" tone="muted">{totalThreads}</Text>
            )}
          </div>

          <div className="threads-layout__sidebar-body">
            {!isSidebarCollapsed ? (
              isLoading ? (
                <div className="threads-layout__sidebar-status">Loading threads...</div>
              ) : error ? (
                <div className="threads-layout__sidebar-status">Error: {error}</div>
              ) : threads.length === 0 ? (
                <div className="threads-layout__sidebar-status">No threads yet</div>
              ) : (
                <div className="threads-layout__thread-list">
                  {optimisticDraftThread ? (
                    <button
                      type="button"
                      className="threads-layout__thread-item threads-layout__thread-item--active"
                      onClick={() => navigate("/threads")}
                    >
                      <span className="threads-layout__thread-title">{optimisticDraftThread.title}</span>
                    </button>
                  ) : null}
                  {threads.map((thread) => {
                    const isSelected = thread.id === threadId;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        className={`threads-layout__thread-item ${isSelected ? "threads-layout__thread-item--active" : ""} ${thread.unreadCount > 0 ? "threads-layout__thread-item--unread" : ""}`}
                        onClick={() => navigate(`/threads/${thread.id}`)}
                      >
                        <span className="threads-layout__thread-title">{thread.title}</span>
                        <UnreadBadge count={thread.unreadCount} />
                      </button>
                    );
                  })}
                  <ThreadListLoadMore />
                </div>
              )
            ) : null}
          </div>

          <button
            type="button"
            className="threads-layout__sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={isSidebarCollapsed ? "Expand threads sidebar" : "Collapse threads sidebar"}
          >
            {isSidebarCollapsed ? "→" : "←"}
          </button>
        </aside>

        <main className="threads-layout__main">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 0 }}>
      {isThreadDetailRoute ? (
          // Thread detail on mobile: bypass IosShell, use custom layout
          <Outlet />
        ) : (
          // Thread list on mobile: use IosShell with bottom nav
          <IosShell
            appTitle="Threads"
            sectionTitle={sectionTitle}
            navItems={navItems}
          >
            <Outlet />
          </IosShell>
        )}
    </div>
  );
}
