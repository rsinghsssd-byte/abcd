import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type User = {
  id: number;
  username: string;
  displayName: string | null;
  onboardingCompleted: boolean;
  theme: string;
};

type AuthContext = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signup: (username: string, password: string) => Promise<void>;
  signin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
};

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Completely bypass authentication by setting a global mock user
    setUser({
      id: 0,
      username: "global_guest",
      displayName: "Global Guest",
      onboardingCompleted: true,
      theme: "light",
    });
    setToken("guest-token-bypass");
    setIsLoading(false);
  }, []);

  const signup = async (username: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      let msg = "Signup failed";
      try { const e = await res.json(); msg = e.error || msg; } catch { msg = `Server error (${res.status})`; }
      throw new Error(msg);
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("roadscan_token", data.token);
    localStorage.setItem("roadscan_user", JSON.stringify(data.user));
    localStorage.setItem("x-username", data.user.username);
  };

  const signin = async (username: string, password: string) => {
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      let msg = "Signin failed";
      try { const e = await res.json(); msg = e.error || msg; } catch { msg = `Server error (${res.status})`; }
      throw new Error(msg);
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("roadscan_token", data.token);
    localStorage.setItem("roadscan_user", JSON.stringify(data.user));
    localStorage.setItem("x-username", data.user.username);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("roadscan_token");
    localStorage.removeItem("roadscan_user");
    localStorage.removeItem("x-username");
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem("roadscan_user", JSON.stringify(updated));
  };

  return (
    <AuthCtx.Provider value={{ user, token, isLoading, signup, signin, logout, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
