import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { ConsentDesktopView } from "./ConsentDesktopView";
import { useConsentCtx } from "./ConsentProvider";
import { IosShell } from "../../app/shells/IosShell";

export function ConsentLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useConsentCtx();

  return (
    <>
      {isDesktop ?
        <ConsentDesktopView>
          <Outlet />
        </ConsentDesktopView>
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