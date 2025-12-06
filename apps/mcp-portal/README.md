# MCP Portal

A modern web interface for managing Model Context Protocol (MCP) servers, agents, tasks, and wiki pages.

## Features

- **Authentication**: Secure cookie-based authentication with identity provider
- **MCP Catalog**: Browse and manage MCP servers with their capabilities
- **Agents**: Create and manage AI agents with custom models and system prompts
- **Taskeroo**: Kanban-style task board with status tracking, tags, and comments
- **Wikiroo**: Knowledge base with markdown support for documentation pages

## Getting Started

### Prerequisites

- Node.js and npm installed
- Backend server running (see `apps/backend`)
- Test user created in the database

### Setup

1. **Create a test user** (first time only):
   ```bash
   cd apps/backend
   npm run init-test-user
   ```

   This creates a test user with the following credentials:
   - Email: `test@example.com`
   - Password: `password123`

2. **Start the backend server**:
   ```bash
   cd apps/backend
   npm run dev
   ```

3. **Start the MCP Portal** (in a new terminal):
   ```bash
   cd apps/mcp-portal
   npm run dev
   ```

4. **Access the portal**:
   - Open your browser to `http://localhost:5174`
   - Login with the test credentials above

## Development

### Project Structure

```
apps/mcp-portal/
├── src/
│   ├── components/      # Reusable UI components
│   ├── config/          # API configuration
│   ├── context/         # React context providers
│   ├── lib/             # API clients and utilities
│   ├── pages/           # Main application pages
│   │   ├── Catalog.tsx  # MCP server catalog
│   │   ├── Agents.tsx   # Agent management
│   │   ├── Taskeroo.tsx # Task board
│   │   └── Wikiroo.tsx  # Wiki pages
│   └── Layouts/         # Page layouts
```

### API Integration

The portal uses OpenAPI-generated clients from the `shared` package. All API services are configured in `src/lib/api.ts` with automatic cookie-based authentication.

### Building for Production

```bash
npm run build:prod
```

This builds the app and copies the production build to `apps/backend/dist/public-mcp` for serving by the backend.

## Technology Stack

- **React 19**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tooling
- **TailwindCSS v4**: Utility-first styling
- **React Router**: Client-side routing
- **React Markdown**: Markdown rendering for wiki pages

## Features by Page

### Catalog
- View all registered MCP servers
- Browse server capabilities
- View detailed server information

### Agents
- Create new AI agents
- Configure model and system prompts
- View all agents in a grid layout

### Taskeroo
- Kanban board with 4 status columns (Not Started, In Progress, For Review, Done)
- Create new tasks
- View task details with comments and tags
- Visual tag indicators with custom colors

### Wikiroo
- Create and edit wiki pages
- Markdown support with GitHub Flavored Markdown
- Tag organization
- Full-page reading view
