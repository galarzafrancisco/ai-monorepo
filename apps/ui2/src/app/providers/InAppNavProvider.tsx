import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { InAppNavigation } from '../../shared/navigation';

interface InAppNavContextValue {
  inAppNav: InAppNavigation | null;
  setInAppNav: (nav: InAppNavigation | null) => void;
}

const InAppNavContext = createContext<InAppNavContextValue | undefined>(undefined);

export interface InAppNavProviderProps {
  children: ReactNode;
}

export function InAppNavProvider({ children }: InAppNavProviderProps) {
  const [inAppNav, setInAppNav] = useState<InAppNavigation | null>(null);

  return (
    <InAppNavContext.Provider value={{ inAppNav, setInAppNav }}>
      {children}
    </InAppNavContext.Provider>
  );
}

export function useInAppNav() {
  const context = useContext(InAppNavContext);
  if (!context) {
    throw new Error('useInAppNav must be used within InAppNavProvider');
  }
  return context;
}
