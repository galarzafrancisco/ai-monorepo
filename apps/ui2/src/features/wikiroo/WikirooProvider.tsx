import React, { useMemo, useState } from "react";
import { WikirooContext, type WikirooContextValue } from "./wikiroo-context";
// import { useWikiroo } from "./useWikiroo"; // your abstraction hook

export function WikirooProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: this is where the one websocket connection should be created
  // const { tasks, isLoading, error, isConnected } = useWikiroo();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<WikirooContextValue>(() => {
    return {
      // tasks,
      // isLoading,
      // error,
      // isConnected,
      sectionTitle,
      setSectionTitle,
    };
  }, [
    // tasks,
    // isLoading,
    // error,
    // isConnected,
    sectionTitle,
    setSectionTitle,
  ]);

  return <WikirooContext.Provider value={value}>{children}</WikirooContext.Provider>;
}
