import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "../lib/types";
import { getApiBaseUrl } from "../config/api";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  reload: async () => {},
});

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/session`, { credentials: "include" });
      if (!res.ok) throw new Error("Not logged in");
      const data = await res.json();
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, reload: loadSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
