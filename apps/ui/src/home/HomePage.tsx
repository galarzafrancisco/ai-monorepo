import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import './HomePage.css';

export function HomePage() {
  usePageTitle('AI Monorepo — Home');

  const apps = [
    {
      name: 'Taskeroo',
      description: 'Manage and track your tasks across different stages with our Kanban board.',
      path: '/taskeroo',
      icon: '📋',
      color: '#3b82f6',
    },
    {
      name: 'Wikiroo',
      description: 'Create, edit, and organize your knowledge base with our wiki platform.',
      path: '/wikiroo',
      icon: '📚',
      color: '#10b981',
    },
    {
      name: 'MCP Registry',
      description: 'Manage Model Context Protocol servers, scopes, and OAuth connections.',
      path: '/mcp-registry',
      icon: '🔌',
      color: '#8b5cf6',
    },
  ];

  return (
    <div className="home-page">
      <div className="home-container">
        <header className="home-header">
          <h1 className="home-title">AI Monorepo</h1>
          <p className="home-subtitle">
            Your all-in-one platform for task management, knowledge organization, and protocol
            integration
          </p>
        </header>

        <div className="apps-grid">
          {apps.map((app) => (
            <Link key={app.path} to={app.path} className="app-card" style={{ '--app-color': app.color } as React.CSSProperties}>
              <div className="app-icon">{app.icon}</div>
              <h2 className="app-name">{app.name}</h2>
              <p className="app-description">{app.description}</p>
              <div className="app-arrow">→</div>
            </Link>
          ))}
        </div>

        <footer className="home-footer">
          <p>Built with React + TypeScript + Vite</p>
        </footer>
      </div>
    </div>
  );
}
