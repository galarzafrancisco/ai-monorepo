import { ReactNode } from "react";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { useWikirooCtx } from "./WikirooProvider";

export function WikirooDesktopView({ children }: { children: ReactNode }) {
  const { sectionTitle } = useWikirooCtx();

  return (
    <DesktopShell sectionTitle={sectionTitle}>
      {children}
    </DesktopShell>
  );
}
