import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useToolsCtx } from "./ToolsProvider";

export function ToolsLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useToolsCtx();

  // No navigation items for tools since it's a simple list + detail view
  const navItems: { path: string; label: string; icon: string }[] = [];

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell
          sectionTitle={sectionTitle}
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Tools"
          sectionTitle={sectionTitle}
          navItems={navItems}
        >
          <Outlet />
        </IosShell>}
    </div>
  );
}
