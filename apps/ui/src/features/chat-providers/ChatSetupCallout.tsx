import { Button, Stack, Text } from '../../ui/primitives';
import './ChatSetupCallout.css';

type ChatSetupCalloutProps = {
  title: string;
  description: string;
  ctaLabel: string;
  onOpenSettings: () => void;
  className?: string;
};

export function ChatSetupCallout({
  title,
  description,
  ctaLabel,
  onOpenSettings,
  className,
}: ChatSetupCalloutProps) {
  return (
    <div className={`chat-setup-callout ${className ?? ''}`.trim()}>
      <div className="chat-setup-callout__badge">Thread Chat</div>
      <Stack spacing="3">
        <Stack spacing="1">
          <Text size="4" weight="semibold">
            {title}
          </Text>
          <Text tone="muted">{description}</Text>
          <Text size="1" tone="muted">
            Visit `/settings/chat` to wire it up.
          </Text>
        </Stack>

        <div className="chat-setup-callout__actions">
          <Button variant="primary" onClick={onOpenSettings}>
            {ctaLabel}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
