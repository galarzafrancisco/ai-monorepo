import { useIsDesktop } from "../hooks/useIsDesktop";
import { MobileLayout } from "../layouts/MobileLayout";
import { DesktopLayout } from "../layouts/DesktopLayout";

export function ShellSwitchLayout() {
  const isDesktop = useIsDesktop();

  return isDesktop ? <DesktopLayout /> : <MobileLayout />;
}