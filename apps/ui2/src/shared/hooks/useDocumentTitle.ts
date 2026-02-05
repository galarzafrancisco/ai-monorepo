import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';

interface RouteData {
  task?: { name?: string };
  agent?: { name?: string };
  tool?: { name?: string };
}

/**
 * Custom hook to dynamically update the browser tab title based on the current route
 * @param routeData - Optional data for dynamic titles (task name, agent name, etc.)
 */
export function useDocumentTitle(routeData?: RouteData) {
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const path = location.pathname;
    let title = 'taico'; // default

    // Home view
    if (path.startsWith('/home')) {
      title = '🏠 taico';
    }
    // Task detail page
    else if (path.match(/\/tasks\/task\/.+/) && routeData?.task?.name) {
      const taskName = routeData.task.name;
      // Trim if too long (max 50 chars)
      const trimmedName = taskName.length > 50 ? taskName.substring(0, 50) + '...' : taskName;
      title = `🧩 ${trimmedName}`;
    }
    // Tasks view
    else if (path.startsWith('/tasks')) {
      title = '🧩 tasks';
    }
    // Context blocks view
    else if (path.startsWith('/context')) {
      title = '🧱 context';
    }
    // Settings pages
    else if (path.startsWith('/settings')) {
      title = '⚙️ settings';
    }
    // Agent detail page
    else if (path.match(/\/agents\/agent\/.+/) && routeData?.agent?.name) {
      title = `🦄 ${routeData.agent.name}`;
    }
    // Agents view
    else if (path.startsWith('/agents')) {
      title = '🦄 agents';
    }
    // Tool detail page
    else if (path.match(/\/tools\/tool\/.+/) && routeData?.tool?.name) {
      title = `🧰 ${routeData.tool.name}`;
    }
    // Tools view
    else if (path.startsWith('/tools')) {
      title = '🧰 tools';
    }
    // Threads view
    else if (path.startsWith('/threads')) {
      title = '🧵 threads';
    }

    document.title = title;
  }, [location.pathname, routeData]);
}
