import { Stack, Text, Card } from '../../ui/primitives';

export function WikirooPage() {
  return (
    <Stack spacing="5">
      <Stack spacing="2">
        <Text size="6" weight="bold">Wikiroo</Text>
        <Text tone="muted">Wiki and documentation system</Text>
      </Stack>

      <Card>
        <Text tone="muted">This page is under construction.</Text>
      </Card>
    </Stack>
  );
}
