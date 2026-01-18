import { ReactNode } from "react";
import "./DesktopShell.css";

export interface DesktopShellProps {
  sectionTitle?: string;
  children: ReactNode;
}

export function DesktopShell({ sectionTitle, children }: DesktopShellProps): JSX.Element {
  return (
    <div className="desktop-shell">
      {sectionTitle && (
        <div className="desktop-shell__header">
          <h1 className="desktop-shell__title">{sectionTitle}</h1>
        </div>
      )}
      <div className="desktop-shell__content">
        {children}
      </div>
    </div>
  );
}
