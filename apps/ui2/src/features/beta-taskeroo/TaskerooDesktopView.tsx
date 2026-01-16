import { ReactNode } from "react";

export function TaskerooDesktopView({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: '100%' }}>
      {children}
    </div>
  )
}