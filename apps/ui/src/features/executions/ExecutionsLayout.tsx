import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";

export function ExecutionsLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const sectionTitle = "Runs";

  const navItems: { path: string; label: string; icon: string }[] = [];

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Runs"
          sectionTitle={sectionTitle}
          navItems={navItems}
        >
          <Outlet />
        </IosShell>}
    </div>
  );
}
