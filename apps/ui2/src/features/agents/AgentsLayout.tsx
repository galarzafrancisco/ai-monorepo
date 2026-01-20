import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useAgentsCtx } from "./AgentsProvider";

export function AgentsLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useAgentsCtx();

  // No navigation items for agents since it's a simple list + detail view
  const navItems: { path: string; label: string; icon: string }[] = [];

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell
          sectionTitle="Agents"
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Agents"
          sectionTitle={sectionTitle}
          navItems={navItems}
        >
          <Outlet />
        </IosShell>}
    </div>
  );
}
