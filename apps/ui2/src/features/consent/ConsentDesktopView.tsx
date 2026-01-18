import { ReactNode } from "react";

export function ConsentDesktopView({ children }: { children: ReactNode }) {
    return (
    <div style={{ height: '100%' }}>
      {children}
    </div>
  )
}