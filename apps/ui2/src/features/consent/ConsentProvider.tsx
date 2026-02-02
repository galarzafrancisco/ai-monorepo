import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useConsent } from "./useConsent"; // your abstraction hook
import { GetConsentMetadataResponseDto } from "@taico/client";

// Shape this to match what pages/layout need.
export type ConsentContextValue = {
  message: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  loadConsentMetadata: (flowId: string) => void;
  consentMetadata: GetConsentMetadataResponseDto | null;
  submitConsent: (flowId: string, serverId: string, approve: boolean) => void;
  error: string | null;
  isLoading: boolean;
  isApproving: boolean;

};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {

  const { message, error, isLoading, isApproving, loadConsentMetadata, consentMetadata, submitConsent } = useConsent();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ConsentContextValue>(() => {
    return {
      message,
      sectionTitle,
      setSectionTitle,
      loadConsentMetadata,
      consentMetadata,
      submitConsent,
      error,
      isLoading,
      isApproving,
    };
  }, [
    message,
    sectionTitle,
    setSectionTitle,
    loadConsentMetadata,
    consentMetadata,
    submitConsent,
    error,
    isLoading,
    isApproving,
  ]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsentCtx(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsentCtx must be used within <ConsentProvider>");
  return ctx;
}
