import React, { useEffect, useState } from "react";
import "./PopShell.css";
import { Text } from "../../ui/primitives";

type PopShellProps = {
  title: string;
  onCancel?: () => void;
  onSave?: () => boolean | Promise<boolean>;


  /** Inner content renders whatever it wants */
  children: React.ReactNode;

  /** Optional: let callers supply their own header actions */
  headerRight?: React.ReactNode;
  headerLeft?: React.ReactNode;

  /** Must match CSS transition duration */
  closeMs?: number;
};

export function PopShell({
  title,
  onCancel,
  onSave,
  children,
  headerLeft,
  headerRight,
  closeMs = 220,
}: PopShellProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  function close() {
    setOpen(false);
    setTimeout(() => onCancel?.(), closeMs);
  }

  async function save() {
    if (!onSave || saving) return;
    try {
      setSaving(true);
      const ok = await onSave();
      if (ok) {
        close(); // only close when caller says it's ok
      }
    } catch {
      // swallow or report; but don't close on error
    } finally {
      setSaving(false);
    }
  }



  return (
    <div className={`pop-shell__overlay ${open ? "pop-shell__overlay--open" : ""}`}>
      <div className="pop-shell__space" onClick={close} />
      <div className={`pop-shell__main-panel ${open ? "pop-shell__main-panel--open" : ""}`}>
        <div className="pop-shell__main-title">
          {headerLeft ?? (
            <div onClick={close}>
              <Text size="4" weight="normal" className="pop-shell__main-title-button">
                cancel
              </Text>
            </div>
          )}

          <Text size="4" weight="medium">
            {title}
          </Text>

          {/* default right spacer keeps title centered */}
          {headerRight ?? (
            <div
              onClick={save}
              style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? "none" : "auto" }}
            >
              <Text size="4" weight="normal" className="pop-shell__main-title-button">
                {saving ? "saving" : "save"}
              </Text>
            </div>
          )}
        </div>

        <div className="pop-shell__main-content">{children}</div>
      </div>
    </div>
  );
}
