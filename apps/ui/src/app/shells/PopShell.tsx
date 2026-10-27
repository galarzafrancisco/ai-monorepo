import React, { useEffect, useState } from "react";
import "./PopShell.css";
import { Text } from "../../ui/primitives";

type PopShellProps = {
  title: string;
  onCancel?: () => void;
  onSave?: () => boolean | Promise<boolean>;
  /** Label of the right header button (default "Save") */
  saveLabel?: string;
  /** Disables the right header button */
  saveDisabled?: boolean;


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
  saveLabel = "Save",
  saveDisabled = false,
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
    if (!onSave || saving || saveDisabled) return;
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Enter") return;
    if (!event.metaKey && !event.ctrlKey) return;

    event.preventDefault();
    save();
  }



  return (
    <div className={`pop-shell__overlay ${open ? "pop-shell__overlay--open" : ""}`}>
      <div className="pop-shell__space" onClick={close} />
      <div
        className={`pop-shell__main-panel ${open ? "pop-shell__main-panel--open" : ""}`}
        onKeyDown={handleKeyDown}
      >
        <div className="pop-shell__main-title">
          {headerLeft ?? (
            <div onClick={close}>
              <Text size="3" weight="normal" className="pop-shell__main-title-button">
                Cancel
              </Text>
            </div>
          )}

          <Text size="3" weight="semibold">
            {title}
          </Text>

          {/* default right spacer keeps title centered */}
          {headerRight ?? (
            <div
              onClick={save}
              style={{
                opacity: saving || saveDisabled ? 0.4 : 1,
                pointerEvents: saving || saveDisabled ? "none" : "auto",
              }}
            >
              <Text size="3" weight="semibold" className="pop-shell__main-title-button">
                {saving ? `${saveLabel}…` : saveLabel}
              </Text>
            </div>
          )}
        </div>

        <div className="pop-shell__main-content">{children}</div>
      </div>
    </div>
  );
}
