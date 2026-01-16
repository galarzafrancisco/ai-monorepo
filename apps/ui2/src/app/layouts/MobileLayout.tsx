// MobileLayout.tsx
import { Outlet } from "react-router-dom";
import { IosShell } from "../shells/IosShell";
import { useShellConfig } from "../providers/ShellConfigProvider";

export function MobileLayout() {
  const cfg = useShellConfig();

  return (
    <IosShell
      appTitle={cfg.appTitle}
      sectionTitle={cfg.sectionTitle ?? ""}
      navItems={cfg.navItems ?? []}
    >
      <Outlet />
    </IosShell>
  );
}
