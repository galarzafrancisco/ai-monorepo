import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Utility function to check if the current viewport is mobile size
 * Can be used in state initializers or anywhere synchronous detection is needed
 * @returns boolean indicating if viewport width is less than 768px
 */
export function isMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Hook to detect if the current viewport is mobile size (reactive)
 * Updates when window is resized
 * @returns boolean indicating if viewport width is less than 768px
 */
export function useIsMobile(): boolean {
  const [isMobileState, setIsMobileState] = useState<boolean>(() => isMobile());

  useEffect(() => {
    const handleResize = () => {
      setIsMobileState(isMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobileState;
}
