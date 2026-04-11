import { Outlet, useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { useContextCtx } from "./ContextProvider";
import { ContextBlockTree } from "./ContextBlockTree";
import { Text, Row } from "../../ui/primitives";
import { MAIN_NAVEGATION_ITEMS } from "../../shared/const/mainNavegationItems";
import "./ContextHome.css";

export function ContextLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle, blocks, isLoading, error } = useContextCtx();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: selectedBlockId } = useParams<{ id?: string }>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    const stored = localStorage.getItem("context-sidebar-collapsed");
    setIsSidebarCollapsed(stored === "true");
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
    localStorage.setItem("context-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isDesktop, isSidebarCollapsed]);

  // Close drawer when navigating
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className={`context-layout ${isDesktop ? 'context-layout--desktop' : 'context-layout--mobile'}`}>

      {/* ── Mobile: drawer ─────────────────────────────────── */}
      {!isDesktop && (
        <>
          {isDrawerOpen && (
            <div
              className="context-layout__drawer-overlay"
              onClick={() => setIsDrawerOpen(false)}
            />
          )}
          <aside className={`context-layout__drawer ${isDrawerOpen ? 'context-layout__drawer--open' : ''}`}>
            <div className="context-layout__drawer-header">
              <Text size="4" weight="bold">taico</Text>
              <button
                className="context-layout__drawer-close"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="context-layout__drawer-nav">
              {MAIN_NAVEGATION_ITEMS.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`context-layout__drawer-item ${isActive ? 'context-layout__drawer-item--active' : ''}`}
                  >
                    <span className="context-layout__drawer-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* ── Mobile: header ─────────────────────────────────── */}
      {!isDesktop && (
        <header className="context-layout__mobile-header">
          <Row spacing="5" align="center">
            <button
              className="context-layout__hamburger"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <Text size="3" weight="normal" as="div">Context</Text>
            <Text size="3" weight="semibold" as="div" className="context-layout__mobile-section-title">
              {sectionTitle}
            </Text>
          </Row>
        </header>
      )}

      {/* ── Desktop: sidebar ───────────────────────────────── */}
      {isDesktop && (
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
                <div className="context-desktop__sidebar-header-actions">
                  <Text as="div" size="1" tone="muted">{blocks.length}</Text>
                  <button
                    type="button"
                    className="context-desktop__sidebar-new"
                    onClick={() => navigate("/context/new")}
                    aria-label="New block"
                    title="New block"
                  >
                    +
                  </button>
                </div>
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
                  onAddChild={(parentId) => navigate(`/context/new?parentId=${parentId}`)}
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
      )}

      {/* ── Content — always in the same tree position ─────── */}
      <main className="context-layout__main">
        <Outlet />
      </main>

    </div>
  );
}
