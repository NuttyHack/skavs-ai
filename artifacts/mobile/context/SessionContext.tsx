import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "learner" | "educator" | "parent";

interface SessionState {
  name: string;
  role: UserRole | null;
  grade: string | null;
  isSetup: boolean;
  educatorAuthenticated: boolean;
}

interface SessionContextValue extends SessionState {
  setSession: (name: string, role: UserRole, grade?: string) => void;
  setEducatorAuthenticated: (val: boolean) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const STORAGE_KEY = "@skavs_session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    name: "",
    role: null,
    grade: null,
    isSetup: false,
    educatorAuthenticated: false,
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as SessionState;
          setState({ ...parsed, educatorAuthenticated: false });
        }
      })
      .catch(() => {});
  }, []);

  function setSession(name: string, role: UserRole, grade?: string) {
    const next: SessionState = {
      name,
      role,
      grade: grade ?? null,
      isSetup: true,
      educatorAuthenticated: state.educatorAuthenticated,
    };
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  function setEducatorAuthenticated(val: boolean) {
    setState((prev) => ({ ...prev, educatorAuthenticated: val }));
  }

  function clearSession() {
    const next: SessionState = {
      name: "",
      role: null,
      grade: null,
      isSetup: false,
      educatorAuthenticated: false,
    };
    setState(next);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  return (
    <SessionContext.Provider value={{ ...state, setSession, setEducatorAuthenticated, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
