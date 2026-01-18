import { ReactNode } from "react";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { useTaskerooCtx } from "./TaskerooProvider";

export function TaskerooDesktopView({ children }: { children: ReactNode }) {
  const { sectionTitle } = useTaskerooCtx();

  return (
    <DesktopShell sectionTitle={sectionTitle}>
      {children}
    </DesktopShell>
  );
}
