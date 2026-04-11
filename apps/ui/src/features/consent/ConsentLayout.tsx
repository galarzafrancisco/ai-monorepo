import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useConsentCtx } from "./ConsentProvider";

export function ConsentLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useConsentCtx();

  return (
    <>
      {isDesktop ?
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Consent"
          sectionTitle={sectionTitle}
          navItems={[]}
        >
          <Outlet />
        </IosShell>
      }
    </>
  )
}
