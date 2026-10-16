import { Pin } from "lucide-react";
import "./ThreadPinButton.css";

/**
 * Small pin icon that pins a thread to the top of the user's list, or unpins it.
 * Filled while pinned. Clicking it never opens the thread.
 *
 * - `row` (default): in list rows. Shown faintly, or only on hover where hover exists.
 * - `header`: next to an open thread's title. Always shown, with a larger touch target.
 */
export function ThreadPinButton({
  pinned,
  onToggle,
  variant = "row",
  className,
}: {
  pinned: boolean;
  onToggle: (pinned: boolean) => void;
  variant?: "row" | "header";
  className?: string;
}): React.JSX.Element {
  const label = pinned ? "Unpin thread" : "Pin thread";
  return (
    <button
      type="button"
      className={[
        "thread-pin-button",
        `thread-pin-button--${variant}`,
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
      <Pin size={variant === "header" ? 16 : 14} strokeWidth={2} fill={pinned ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
