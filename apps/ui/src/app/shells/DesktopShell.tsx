import { ReactNode } from "react";
import "./DesktopShell.css";

export interface DesktopShellProps {
  sectionTitle?: string;
  titleAccessory?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function DesktopShell({ sectionTitle, titleAccessory, headerActions, children }: DesktopShellProps): React.JSX.Element {
  return (
    <div className="desktop-shell">
      {sectionTitle && (
        <div className="desktop-shell__header">
          <div className="desktop-shell__title-row">
            <h1 className="desktop-shell__title">{sectionTitle}</h1>
            {titleAccessory ? (
              <div className="desktop-shell__title-accessory">{titleAccessory}</div>
            ) : null}
          </div>
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
