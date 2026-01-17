import { createContext, useContext } from "react";

export type HomeContextValue = {
  message: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

export const HomeContext = createContext<HomeContextValue | null>(null);

export function useHomeCtx(): HomeContextValue {
  const ctx = useContext(HomeContext);
  if (!ctx) {
    throw new Error("useHomeCtx must be used within <HomeProvider>");
  }
  return ctx;
}
