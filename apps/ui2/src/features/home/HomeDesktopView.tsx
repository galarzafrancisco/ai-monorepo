import { ReactNode } from "react";

export function HomeDesktopView({ children }: { children: ReactNode }) {
    return (
    <div style={{ height: '100%' }}>
      {children}
    </div>
  )
}