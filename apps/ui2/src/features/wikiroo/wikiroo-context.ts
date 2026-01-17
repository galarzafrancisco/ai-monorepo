import { createContext, useContext } from "react";

export type WikirooContextValue = {
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

export const WikirooContext = createContext<WikirooContextValue | null>(null);

export function useWikirooCtx(): WikirooContextValue {
  const ctx = useContext(WikirooContext);
  if (!ctx) {
    throw new Error("useWikirooCtx must be used within <WikirooProvider>");
  }
  return ctx;
}
