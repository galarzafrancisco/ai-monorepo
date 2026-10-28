import { useState } from 'react';
import { Button, Row, Stack, Text } from '../../ui/primitives';
import './GithubWebhookFields.css';

/** The events Taico reads; anything else GitHub sends is ignored. */
export const GITHUB_WEBHOOK_EVENTS = [
  'Pull requests',
  'Pull request reviews',
  'Pull request review comments',
  'Issues',
  'Issue comments',
  'Check runs',
  'Check suites',
  'Statuses',
];

/** Payload URL and secret of a GitHub connection's webhook, each with a copy button. */
export function GithubWebhookFields({ url, secret }: { url: string; secret: string }) {
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null);

  const copy = async (what: 'url' | 'secret', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <>
      <WebhookField label="Payload URL" value={url} copied={copied === 'url'} onCopy={() => void copy('url', url)} />
      <WebhookField
        label="Secret"
        value={secret}
        secret
        copied={copied === 'secret'}
        onCopy={() => void copy('secret', secret)}
      />
    </>
  );
}

function WebhookField({
  label,
  value,
  secret = false,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Stack spacing="1">
      <Text size="1" weight="medium">
        {label}
      </Text>
      <Row spacing="2" align="center">
        <input
          readOnly
          type={secret ? 'password' : 'text'}
          value={value}
          className="github-webhook-fields__value"
          aria-label={label}
          onFocus={(event) => event.target.select()}
        />
        <Button variant="secondary" size="sm" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Row>
    </Stack>
  );
}
