import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { WikirooDesktopView } from "./WikirooDesktopView";
import { IosShell } from "../../app/shells/IosShell";
import { useWikirooCtx } from "./WikirooProvider";

export function WikirooLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useWikirooCtx();;

  console.log('Wikiroo layout mounting');

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <WikirooDesktopView>
          <Outlet />
        </WikirooDesktopView>
        :
        <IosShell
          appTitle="Wikiroo"
          sectionTitle={sectionTitle}
          navItems={[]}
        >
          <Outlet />
        </IosShell>}
    </div>
  )
}