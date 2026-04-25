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

    if (path.startsWith('/home')) {
      title = 'taico';
    }
    else if (path.match(/\/tasks\/task\/.+/) && routeData?.task?.name) {
      const taskName = routeData.task.name;
      const trimmedName = taskName.length > 50 ? taskName.substring(0, 50) + '...' : taskName;
      title = trimmedName;
    }
    else if (path.startsWith('/tasks')) {
      title = 'tasks';
    }
    else if (path.match(/\/context\/block\/.+/) && routeData?.contextBlock?.title) {
      const blockTitle = routeData.contextBlock.title;
      const trimmedTitle = blockTitle.length > 50 ? blockTitle.substring(0, 50) + '...' : blockTitle;
      title = trimmedTitle;
    }
    else if (path.startsWith('/context')) {
      title = 'context';
    }
    else if (path.startsWith('/settings')) {
      title = 'settings';
    }
    else if (path.match(/\/agents\/agent\/.+/) && routeData?.agent?.name) {
      title = routeData.agent.name;
    }
    else if (path.startsWith('/agents')) {
      title = 'agents';
    }
    else if (path.match(/\/tools\/tool\/.+/) && routeData?.tool?.name) {
      title = routeData.tool.name;
    }
    else if (path.startsWith('/tools')) {
      title = 'tools';
    }
    else if (path.match(/\/threads\/.+/) && routeData?.thread?.title) {
      const threadTitle = routeData.thread.title;
      const trimmedTitle = threadTitle.length > 50 ? threadTitle.substring(0, 50) + '...' : threadTitle;
      title = trimmedTitle;
    }
    else if (path.startsWith('/threads')) {
      title = 'threads';
    }
    else if (path.startsWith('/runs') || path.startsWith('/executions')) {
      title = 'runs';
    }
    else if (path.startsWith('/walkthrough')) {
      title = 'walkthrough';
    }

    document.title = title;
  }, [location.pathname, routeData]);
}
