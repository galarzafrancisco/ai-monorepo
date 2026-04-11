import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useHome } from "./useHome"; // your abstraction hook

// Shape this to match what pages/layout need.
export type HomeContextValue = {
  message: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

const HomeContext = createContext<HomeContextValue | null>(null);

export function HomeProvider({ children }: { children: React.ReactNode }) {

  const { message } = useHome();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<HomeContextValue>(() => {
    return {
      message,
      sectionTitle,
      setSectionTitle,
    };
  }, [
    message,
    sectionTitle,
    setSectionTitle,
  ]);

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export function useHomeCtx(): HomeContextValue {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHomeCtx must be used within <HomeProvider>");
  return ctx;
}
