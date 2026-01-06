export const APP_NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/taskeroo', label: 'Taskeroo', icon: '✓' },
  { path: '/wikiroo', label: 'Wikiroo', icon: '📖' },
  { path: '/mcp-registry', label: 'MCP Registry', icon: '🔌' },
  { path: '/agents', label: 'Agents', icon: '🤖' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/logout', label: 'Logout', icon: '🚪' },
];

export function getPageTitle(pathname: string): string {
  // Find exact match or match by prefix (for nested routes like /taskeroo/in-progress)
  const item = APP_NAV_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(item.path + '/')
  );
  return item?.label || 'AI Monorepo';
}
