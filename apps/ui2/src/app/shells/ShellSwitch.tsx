import React from "react";
import { DesktopShell } from "./DesktopShell";
import { MobileShell } from "./MobileShell";
import { useIsDesktop } from "../hooks/useIsDesktop";

export function ShellSwitch({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  return isDesktop ? (
    <DesktopShell>{children}</DesktopShell>
  ) : (
    <MobileShell>{children}</MobileShell>
  );
}
