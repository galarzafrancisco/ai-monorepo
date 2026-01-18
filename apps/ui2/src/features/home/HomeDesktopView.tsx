import { ReactNode } from "react";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { useHomeCtx } from "./HomeProvider";

export function HomeDesktopView({ children }: { children: ReactNode }) {
  const { sectionTitle } = useHomeCtx();

  return (
    <DesktopShell sectionTitle={sectionTitle}>
      {children}
    </DesktopShell>
  );
}
