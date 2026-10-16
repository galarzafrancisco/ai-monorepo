import { Pin } from "lucide-react";
import "./ThreadPinButton.css";

/**
 * Small pin icon that pins a thread to the top of the user's list, or unpins it.
 * Filled while pinned. Rows show it faintly, or only on hover where hover exists.
 * Clicking it never opens the thread.
 */
export function ThreadPinButton({
  pinned,
  onToggle,
  className,
}: {
  pinned: boolean;
  onToggle: (pinned: boolean) => void;
  className?: string;
}): React.JSX.Element {
  const label = pinned ? "Unpin thread" : "Pin thread";
  return (
    <button
      type="button"
      className={[
        "thread-pin-button",
        pinned ? "thread-pin-button--pinned" : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={pinned}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onToggle(!pinned);
      }}
    >
      <Pin size={14} strokeWidth={2} fill={pinned ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
