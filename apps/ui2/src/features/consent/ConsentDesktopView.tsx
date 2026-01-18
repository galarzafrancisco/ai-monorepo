import { ReactNode } from "react";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { useConsentCtx } from "./ConsentProvider";

export function ConsentDesktopView({ children }: { children: ReactNode }) {
  const { sectionTitle } = useConsentCtx();

  return (
    <DesktopShell sectionTitle={sectionTitle}>
      {children}
    </DesktopShell>
  );
}
