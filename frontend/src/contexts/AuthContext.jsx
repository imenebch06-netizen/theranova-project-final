import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { getTokens, setTokens, extractError } from "../lib/api";
import { useI18n } from "./I18nContext";

const AuthContext = createContext(null);

const USER_KEY = "theranova.user";

function readCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function normalize(payload) {
  if (!payload) return null;
  // login returns { user: { user, patient, therapist }, access, refresh }
  if (payload.user && payload.user.user) return payload.user;
  // /auth/me/ returns { user, patient, therapist }
  if (payload.user) return payload;
  return { user: payload, patient: null, therapist: null };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readCachedUser());
  const [loading, setLoading] = useState(() => Boolean(getTokens()?.access));
  const { setLang } = useI18n();

  const persist = useCallback(
    (payload) => {
      const next = normalize(payload);
      setSession(next);
      if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
      else localStorage.removeItem(USER_KEY);
      return next;
    },
    [],
  );

  const clear = useCallback(() => {
    setTokens(null);
    setSession(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshMe = useCallback(async () => {
    const { data } = await api.get("/auth/me/");
    return persist(data);
  }, [persist]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!getTokens()?.access) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me/");
        if (active) persist(data);
      } catch {
        if (active) clear();
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [persist, clear]);

  useEffect(() => {
    const onLogout = () => clear();
    window.addEventListener("theranova:logout", onLogout);
    return () => window.removeEventListener("theranova:logout", onLogout);
  }, [clear]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/auth/login/", { email, password });
      setTokens({ access: data.access, refresh: data.refresh });
      const next = persist(data);
      if (next?.user?.language === "en") setLang("en");
      return next;
    },
    [persist, setLang],
  );

  const loginWithGoogle = useCallback(
    async ({ credential, email, first_name, last_name }) => {
      const { data } = await api.post("/auth/google/", {
        credential: credential || email,
        email,
        first_name,
        last_name,
      });
      setTokens({ access: data.access, refresh: data.refresh });
      return persist(data);
    },
    [persist],
  );

  const registerPatient = useCallback(
    async (values) => {
      const { data } = await api.post("/auth/register/patient/", values);
      setTokens({ access: data.access, refresh: data.refresh });
      return persist(data);
    },
    [persist],
  );

  const registerTherapist = useCallback(
    async (values) => {
      const { data } = await api.post("/auth/register/therapist/", values);
      setTokens({ access: data.access, refresh: data.refresh });
      return persist(data);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    try {
      if (tokens?.refresh) {
        await api.post("/auth/logout/", { refresh: tokens.refresh });
      }
    } catch {
      /* best effort */
    } finally {
      clear();
    }
  }, [clear]);

  const updateSession = useCallback(
    (payload) => persist(payload),
    [persist],
  );

  const value = useMemo(() => {
    const user = session?.user || null;
    return {
      user,
      patient: session?.patient || null,
      therapist: session?.therapist || null,
      role: user?.role || null,
      isAuthenticated: Boolean(user),
      loading,
      login,
      loginWithGoogle,
      registerPatient,
      registerTherapist,
      logout,
      refreshMe,
      updateSession,
      isPatient: user?.role === "patient",
      isTherapist: user?.role === "therapist",
      isAdmin: user?.role === "admin",
      displayName: user?.full_name || user?.email || "",
    };
  }, [
    session,
    loading,
    login,
    loginWithGoogle,
    registerPatient,
    registerTherapist,
    logout,
    refreshMe,
    updateSession,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function roleHome(role) {
  if (role === "therapist") return "/pro";
  if (role === "admin") return "/admin";
  return "/app";
}

export { extractError };
