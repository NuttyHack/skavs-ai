import React, { createContext, useContext, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";

export type UserRole = "learner" | "educator" | "parent";

interface SessionState {
  name: string;
  role: UserRole | null;
  isSetup: boolean;
}

interface SessionContextValue extends SessionState {
  setSession: (name: string, role: UserRole) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "@skavs_session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    name: "",
    role: null,
    isSetup: false,
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as SessionState;
          setState(parsed);
        }
      })
      .catch(() => {});
  }, []);

  function setSession(name: string, role: UserRole) {
    const next: SessionState = { name, role, isSetup: true };
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  function clearSession() {
    const next: SessionState = { name: "", role: null, isSetup: false };
    setState(next);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  return (
    <SessionContext.Provider value={{ ...state, setSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
