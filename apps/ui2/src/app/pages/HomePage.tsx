import { Link } from 'react-router-dom';
import { Stack, Text, ListRow, Card } from '../../ui/primitives';

const LINKS = [
  { path: '/taskeroo', label: 'Taskeroo', description: 'Task management system' },
  { path: '/wikiroo', label: 'Wikiroo', description: 'Wiki and documentation' },
  { path: '/mcp-registry', label: 'MCP Registry', description: 'Model Context Protocol registry' },
  { path: '/agents', label: 'Agents', description: 'AI agent management' },
  { path: '/settings', label: 'Settings', description: 'Customize your experience' },
  { path: '/logout', label: 'Logout', description: 'Sign out of your account' },
];

export function HomePage() {
  return (
    <Stack spacing="6">
      <Stack spacing="3">
        <Text size="6" weight="bold">Welcome to AI Monorepo</Text>
        <Text size="3" tone="muted">
          Choose a section to get started
        </Text>
      </Stack>

      {/* Navigation Links */}
      <Card padding="2">
        {LINKS.map((link) => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListRow interactive>
              <Stack spacing="1">
                <Text weight="medium">{link.label}</Text>
                <Text size="1" tone="muted">{link.description}</Text>
              </Stack>
            </ListRow>
          </Link>
        ))}
      </Card>
    </Stack>
  );
}
