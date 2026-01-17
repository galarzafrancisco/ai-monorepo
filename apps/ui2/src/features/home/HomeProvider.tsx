import React, { useMemo, useState } from "react";
import { useHome } from "./useHome"; // your abstraction hook
import { HomeContext, type HomeContextValue } from "./home-context";

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
