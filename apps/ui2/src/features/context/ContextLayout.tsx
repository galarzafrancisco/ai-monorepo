import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useContextCtx } from "./ContextProvider";

export function ContextLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useContextCtx();

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
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
