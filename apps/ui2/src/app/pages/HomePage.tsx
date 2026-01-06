import { Link } from 'react-router-dom';
import { Stack, Text, ListRow, Card, Divider } from '../../ui/primitives';
import { useTheme } from '../providers';
import { Row, Button } from '../../ui/primitives';

const LINKS = [
  { path: '/taskeroo', label: 'Taskeroo', description: 'Task management system' },
  { path: '/wikiroo', label: 'Wikiroo', description: 'Wiki and documentation' },
  { path: '/mcp-registry', label: 'MCP Registry', description: 'Model Context Protocol registry' },
  { path: '/agents', label: 'Agents', description: 'AI agent management' },
  { path: '/logout', label: 'Logout', description: 'Sign out of your account' },
];

export function HomePage() {
  const { theme, setTheme } = useTheme();

  // console.log(theme)
  return (
    <Stack spacing="6">
      <Stack spacing="3">
        <Text size="6" weight="bold">Welcome to AI Monorepo</Text>
        <Text size="3" tone="muted">
          Choose a section to get started
        </Text>
      </Stack>

      {/* Theme Switcher */}
      <Card padding="4">
        <Stack spacing="3">
          <Text size="3" weight="semibold">Theme</Text>
          <Row spacing="2">
            <Button
              variant={theme === 'light' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme('light')}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme('dark')}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'github' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme('github')}
            >
              GitHub
            </Button>
            <Button
              variant={theme === 'forest' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme('forest')}
            >
              Forest
            </Button>
          </Row>
        </Stack>
      </Card>

      <Divider />

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
