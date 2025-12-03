import { Link } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";
import "./HomePage.css";

export function HomePage() {
  usePageTitle("AI Monorepo — Home");

  const apps = [
    {
      name: "Taskeroo",
      description: "Task management with Kanban boards",
      path: "/taskeroo",
      icon: "✓",
      color: "#6366f1",
    },
    {
      name: "Wikiroo",
      description: "Knowledge base and wiki pages",
      path: "/wikiroo",
      icon: "◈",
      color: "#a855f7",
    },
    {
      name: "MCP Registry",
      description: "Model Context Protocol servers",
      path: "/mcp-registry",
      icon: "◆",
      color: "#3b82f6",
    },
  ];

  return (
    <div className="home-page">
      <div className="home-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
      </div>

      <div className="home-container">
        <header className="home-header">
          <h1 className="home-title">
            <span className="title-gradient">AI Monorepo</span>
          </h1>
          <p className="home-subtitle">
            A collection of tools for productivity and knowledge management
          </p>
        </header>

        <div className="apps-grid">
          {apps.map((app) => (
            <Link
              key={app.path}
              to={app.path}
              className="app-card"
              style={{ "--app-color": app.color } as React.CSSProperties}
            >
              <div className="app-icon">{app.icon}</div>
              <div className="app-content">
                <h2 className="app-name">{app.name}</h2>
                <p className="app-description">{app.description}</p>
              </div>
              <div className="app-arrow">→</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
