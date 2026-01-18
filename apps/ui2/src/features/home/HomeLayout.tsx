import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useHomeCtx } from "./HomeProvider";
import { HOME_NAVEGATION_ITEMS } from "./const";

export function HomeLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useHomeCtx();

  return (
    <>
      {isDesktop ?
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Home"
          sectionTitle={sectionTitle}
          navItems={HOME_NAVEGATION_ITEMS}
        >
          <Outlet />
        </IosShell>
      }
    </>
  )
}
