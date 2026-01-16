import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { HomeDesktopView } from "./HomeDesktopView";
import { IosShell } from "../../app/shells/IosShell";
import { HomeProvider, useHomeCtx } from "./HomeProvider";
import { HOME_NAVEGATION_ITEMS } from "./const";

export function HomeLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useHomeCtx();

  console.log('Home layout mounting');
  console.log(sectionTitle);

  return (
    <HomeProvider>
      {isDesktop ?
        <HomeDesktopView>
          <Outlet />
        </HomeDesktopView>
        :
        <IosShell
          appTitle="Home"
          sectionTitle={sectionTitle}
          navItems={HOME_NAVEGATION_ITEMS}
        >
          <Outlet />
        </IosShell>}
    </HomeProvider>
  )
}