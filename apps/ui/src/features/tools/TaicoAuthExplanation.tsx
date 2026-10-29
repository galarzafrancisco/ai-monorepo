import { Stack, Text } from '../../ui/primitives';

/** What the "Use Taico authentication" switch does, for an HTTP MCP server. */
export function TaicoAuthExplanation() {
  return (
    <Stack spacing="1">
      <Text size="1" tone="muted">
        On: Taico is this server's authorization server. Agents send it their Taico execution
        token and execution ID, and Taico serves its OAuth sign-in for it.
      </Text>
      <Text size="1" tone="muted">
        Off: the server handles its own authentication. Agents send it no Taico credentials,
        and Taico's OAuth routes for it are turned off.
      </Text>
      <Text size="1" tone="muted">
        Either way, agents only get the tools you give them.
      </Text>
    </Stack>
  );
}
