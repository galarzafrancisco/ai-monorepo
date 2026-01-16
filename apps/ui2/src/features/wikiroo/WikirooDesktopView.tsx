import { ReactNode } from "react";

export function WikirooDesktopView({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: '100%' }}>
      {children}
    </div>
  )
}