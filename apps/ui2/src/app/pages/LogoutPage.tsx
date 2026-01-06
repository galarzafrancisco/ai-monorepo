import { Stack, Text, Card, Button } from '../../ui/primitives';

export function LogoutPage() {
  const handleLogout = () => {
    // Placeholder - no actual backend call
    // In real implementation, this would clear the auth cookie
    alert('Logout functionality is not implemented yet (placeholder page)');
  };

  return (
    <Stack spacing="5">
      <Stack spacing="2">
        <Text size="6" weight="bold">Logout</Text>
        <Text tone="muted">Sign out of your account</Text>
      </Stack>

      <Card>
        <Stack spacing="4">
          <Text>Are you sure you want to log out?</Text>
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
