import { ReactNode } from "react";
import "./DesktopShell.css";

export interface DesktopShellProps {
  sectionTitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function DesktopShell({ sectionTitle, headerActions, children }: DesktopShellProps): JSX.Element {
  return (
    <div className="desktop-shell">
      {sectionTitle && (
        <div className="desktop-shell__header">
          <h1 className="desktop-shell__title">{sectionTitle}</h1>
          {headerActions ? (
            <div className="desktop-shell__actions">{headerActions}</div>
          ) : null}
        </div>
      )}
      <div className="desktop-shell__content">
        {children}
      </div>
    </div>
  );
}
