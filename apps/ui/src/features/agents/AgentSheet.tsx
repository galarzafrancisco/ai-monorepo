import type { ReactNode } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Button, Modal } from "../../ui/primitives";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import "./AgentSheet.css";

type AgentSheetProps = {
  title: string;
  onClose: () => void;
  /** Main action. Return true to close the sheet. Omit for a read-only sheet. */
  primary?: {
    label: string;
    onClick: () => boolean | Promise<boolean>;
    disabled?: boolean;
  };
  /** Label of the close button when there is no primary action */
  closeLabel?: string;
  children: ReactNode;
};

/** A bottom sheet on phones and a centered dialog on desktop. */
export function AgentSheet({ title, onClose, primary, closeLabel = 'Done', children }: AgentSheetProps) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <PopShell
        title={title}
        onCancel={onClose}
        onSave={primary ? primary.onClick : () => true}
        saveLabel={primary ? primary.label : closeLabel}
        saveDisabled={primary?.disabled}
        headerLeft={primary ? undefined : <span />}
      >
        <div className="agent-sheet agent-sheet--mobile">{children}</div>
      </PopShell>
    );
  }

  const runPrimary = async () => {
    if (!primary) return;
    if (await primary.onClick()) onClose();
  };

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title={title}>
      <div className="agent-sheet agent-sheet--desktop">{children}</div>
      <div className="agent-sheet__footer">
        {primary ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={runPrimary} disabled={primary.disabled}>{primary.label}</Button>
          </>
        ) : (
          <Button onClick={onClose}>{closeLabel}</Button>
        )}
      </div>
    </Modal>
  );
}
