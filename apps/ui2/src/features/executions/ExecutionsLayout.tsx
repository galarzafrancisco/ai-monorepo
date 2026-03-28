import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useExecutionsCtx } from "./ExecutionsProvider";

export function ExecutionsLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useExecutionsCtx();

  const navItems: { path: string; label: string; icon: string }[] = [];

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Executions"
          sectionTitle={sectionTitle}
          navItems={navItems}
        >
          <Outlet />
        </IosShell>}
    </div>
  );
}
