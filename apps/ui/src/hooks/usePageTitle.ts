import { useEffect, useRef } from 'react';

/**
 * Updates the document title while the component is mounted and restores the previous
 * title when it unmounts. Useful for per-route tab titles.
 */
export function usePageTitle(title: string) {
  const previousTitle = useRef<string | null>(null);

  useEffect(() => {
    previousTitle.current = document.title;
    document.title = title;

    return () => {
      if (previousTitle.current !== null) {
        document.title = previousTitle.current;
      }
    };
  }, [title]);
}
