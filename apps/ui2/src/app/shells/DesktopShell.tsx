import { ReactNode } from "react";
import "./DesktopShell.css";

export interface DesktopShellProps {
  sectionTitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function DesktopShell({ sectionTitle, headerRight, children }: DesktopShellProps): JSX.Element {
  return (
    <div className="desktop-shell">
      {(sectionTitle || headerRight) && (
        <div className="desktop-shell__header">
          {sectionTitle ? <h1 className="desktop-shell__title">{sectionTitle}</h1> : <div />}
          {headerRight ? <div className="desktop-shell__header-right">{headerRight}</div> : null}
        </div>
      )}
      <div className="desktop-shell__content">
        {children}
      </div>
    </div>
  );
}
