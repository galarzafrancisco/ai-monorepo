import { PlugZap } from "lucide-react";
import { Button, Text } from "../../ui/primitives";
import type { ChatReadinessKind } from "../ai-models/useChatReadiness";
import "./ThreadChatLocked.css";

type LockedCopy = { title: string; description: string; ctaLabel: string };

const COPY: Record<Exclude<ChatReadinessKind, "ready">, LockedCopy> = {
  "needs-provider": {
    title: "Connect an AI provider to chat",
    description: "Agents can't answer in this thread until an AI provider is connected and a conversation model is picked.",
    ctaLabel: "Set up chat",
  },
  "needs-model": {
    title: "Pick a conversation model",
    description: "A provider is connected, but no model is chosen to answer in threads.",
    ctaLabel: "Pick a model",
  },
  "needs-credentials": {
    title: "Finish provider setup",
    description: "A conversation model is picked, but its provider still needs credentials before it can answer.",
    ctaLabel: "Finish setup",
  },
};

interface ThreadChatLockedProps {
  kind: Exclude<ChatReadinessKind, "ready">;
  /**
   * `full` covers the whole chat (nothing to read yet); `composer` covers only
   * the message box, so an existing conversation stays readable.
   */
  variant: "full" | "composer";
  onOpenSettings: () => void;
}

/** Says why nobody can answer in this thread yet, and where to fix it. */
export function ThreadChatLocked({ kind, variant, onOpenSettings }: ThreadChatLockedProps) {
  const copy = COPY[kind];
  return (
    <div className={`thread-chat-locked thread-chat-locked--${variant}`} role="region" aria-label="Chat is off">
      <div className="thread-chat-locked__content">
        <span className="thread-chat-locked__icon" aria-hidden="true">
          <PlugZap size={variant === "full" ? 18 : 16} />
        </span>
        <div className="thread-chat-locked__text">
          <Text size={variant === "full" ? "3" : "2"} weight="semibold">{copy.title}</Text>
          <Text size={variant === "full" ? "2" : "1"} tone="muted">{copy.description}</Text>
        </div>
        <Button variant="primary" size={variant === "full" ? "md" : "sm"} onClick={onOpenSettings}>
          {copy.ctaLabel}
        </Button>
      </div>
    </div>
  );
}
