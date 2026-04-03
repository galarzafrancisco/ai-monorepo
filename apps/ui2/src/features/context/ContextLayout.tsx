import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { IosShell } from "../../app/shells/IosShell";
import { useContextCtx } from "./ContextProvider";
import { ContextBlockTree } from "./ContextBlockTree";
import { Text } from "../../ui/primitives";
import "./ContextHome.css";

export function ContextLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle, blocks, isLoading, error } = useContextCtx();
  const navigate = useNavigate();
  const { id: selectedBlockId } = useParams<{ id?: string }>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const stored = localStorage.getItem("context-sidebar-collapsed");
    setIsSidebarCollapsed(stored === "true");
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    localStorage.setItem("context-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isDesktop, isSidebarCollapsed]);

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <div className="context-desktop">
          <aside className={`context-desktop__sidebar ${isSidebarCollapsed ? "context-desktop__sidebar--collapsed" : ""}`}>
            <div className="context-desktop__sidebar-header">
              {!isSidebarCollapsed ? (
                <>
                  <button
                    type="button"
                    className="context-desktop__sidebar-title"
                    onClick={() => navigate("/context/home")}
                  >
                    <Text as="span" size="2" weight="semibold">Context</Text>
                  </button>
                  <Text as="div" size="1" tone="muted">{blocks.length}</Text>
                </>
              ) : (
                <Text as="div" size="1" tone="muted">{blocks.length}</Text>
              )}
            </div>

            <div className="context-desktop__sidebar-body">
              {!isSidebarCollapsed ? (
                isLoading ? (
                  <div className="context-home__loading">Loading context blocks...</div>
                ) : error ? (
                  <div className="context-home__error">Error: {error}</div>
                ) : blocks.length === 0 ? (
                  <div className="context-home__empty">No context blocks found</div>
                ) : (
                  <ContextBlockTree
                    blocks={blocks}
                    onOpenBlock={(blockId) => navigate(`/context/block/${blockId}`)}
                    selectedBlockId={selectedBlockId}
                    compact
                  />
                )
              ) : null}
            </div>

            <button
              type="button"
              className="context-desktop__sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              aria-label={isSidebarCollapsed ? "Expand context sidebar" : "Collapse context sidebar"}
            >
              {isSidebarCollapsed ? "→" : "←"}
            </button>
          </aside>

          <main className="context-desktop__main">
            <Outlet />
          </main>
        </div>
        :
        <IosShell
          appTitle="Context"
          sectionTitle={sectionTitle}
          navItems={[]}
        >
          <Outlet />
        </IosShell>}
    </div>
  )
}
