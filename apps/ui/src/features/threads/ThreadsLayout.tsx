import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { IosShell } from "../../app/shells/IosShell";
import { Text } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import "./ThreadsLayout.css";

export function ThreadsLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { id: threadId } = useParams<{ id?: string }>();
  const isThreadDetailRoute = Boolean(threadId);
  const navigate = useNavigate();
  const { threads, isLoading, error, sectionTitle, navItems, optimisticDraftThread } = useThreadsCtx();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
                  <Text as="div" size="1" tone="muted">{threads.length}</Text>
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
            ) : (
              <Text as="div" size="1" tone="muted">{threads.length}</Text>
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
                        className={`threads-layout__thread-item ${isSelected ? "threads-layout__thread-item--active" : ""}`}
                        onClick={() => navigate(`/threads/${thread.id}`)}
                      >
                        <span className="threads-layout__thread-title">{thread.title}</span>
                      </button>
                    );
                  })}
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
