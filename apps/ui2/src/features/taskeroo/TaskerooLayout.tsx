import { useEffect, useMemo, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Stack } from '../../ui/primitives';
import { useInAppNav } from '../../app/providers';
import { taskerooNavigation } from './navigation';
import { STATUS_CONFIG } from './const';
import { TaskerooProvider, useTaskerooCtx } from './TaskerooProvider';
import { TaskerooDesktopView } from './TaskerooDesktopView';
import './TaskerooLayout.css';
import { ErrorText } from '../../ui/primitives/ErrorText';

function TaskerooConnectionHeader() {
  const { isConnected } = useTaskerooCtx();
  return isConnected || <ErrorText>Disconnected</ErrorText>
}

export function TaskerooLayout() {
  const { setInAppNav, setScrolledTitle } = useInAppNav();
  const location = useLocation();
  const titleRef = useRef<HTMLDivElement>(null);

  const activeSection = useMemo(() => {
    return STATUS_CONFIG.find((item) => location.pathname.startsWith(item.path));
  }, [location.pathname]);

  useEffect(() => {
    // Register in-app navigation when this layout mounts
    setInAppNav(taskerooNavigation);

    // Clean up when unmounting
    return () => {
      setInAppNav(null);
      setScrolledTitle(null);
    };
  }, [setInAppNav, setScrolledTitle]);

  // Detect when the large title scrolls out of view
  useEffect(() => {
    if (!titleRef.current || !activeSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When title is not fully visible, show it in header
        setScrolledTitle(entry.isIntersecting ? null : activeSection.label);
      },
      {
        threshold: [0, 1],
        rootMargin: '-60px 0px 0px 0px', // Account for header height
      }
    );

    observer.observe(titleRef.current);

    return () => {
      observer.disconnect();
    };
  }, [activeSection, setScrolledTitle]);
  
  return (
    <TaskerooProvider>
      {/* Desktop view - shows board/list toggle */}
      <div className="taskeroo-layout--desktop">
        <TaskerooDesktopView />
      </div>

      {/* Mobile view - shows routed content (tabs are in bottom nav) */}
      <div className="taskeroo-layout--mobile">
        <Stack spacing="0">
          {activeSection && (
            <div ref={titleRef} className="taskeroo-layout__large-title">
              {activeSection.label}
            </div>
          )}
          <TaskerooConnectionHeader />

          {/* Routed content */}
          <Outlet />
        </Stack>
      </div>
    </TaskerooProvider>
  );
}
