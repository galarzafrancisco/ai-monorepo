import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';

interface RouteData {
  task?: { name?: string };
  agent?: { name?: string };
  tool?: { name?: string };
  thread?: { title?: string };
  contextBlock?: { title?: string };
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
    // Context block detail page
    else if (path.match(/\/context\/block\/.+/) && routeData?.contextBlock?.title) {
      const blockTitle = routeData.contextBlock.title;
      // Trim if too long (max 50 chars)
      const trimmedTitle = blockTitle.length > 50 ? blockTitle.substring(0, 50) + '...' : blockTitle;
      title = `🧱 ${trimmedTitle}`;
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
    // Thread detail page
    else if (path.match(/\/threads\/.+/) && routeData?.thread?.title) {
      const threadTitle = routeData.thread.title;
      // Trim if too long (max 50 chars)
      const trimmedTitle = threadTitle.length > 50 ? threadTitle.substring(0, 50) + '...' : threadTitle;
      title = `🧵 ${trimmedTitle}`;
    }
    // Threads view
    else if (path.startsWith('/threads')) {
      title = '🧵 threads';
    }
    // Runs view
    else if (path.startsWith('/runs') || path.startsWith('/executions')) {
      title = '⚡ runs';
    }
    // Walkthrough
    else if (path.startsWith('/walkthrough')) {
      title = '🐣 walkthrough';
    }

    document.title = title;
  }, [location.pathname, routeData]);
}
