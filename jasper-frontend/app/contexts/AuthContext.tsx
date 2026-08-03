"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type UserRole = "researcher" | "admin" | "superadmin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface AuthContextValue {
  currentUser: AppUser | null;
  users: AppUser[];
  isLoading: boolean;
  pendingSuperadmin: AppUser | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; requiresConfirm?: boolean }>;
  confirmSuperadmin: () => void;
  cancelSuperadmin: () => Promise<void>;
  logout: () => Promise<void>;
  addUser: (data: { name: string; email: string; password: string; role: UserRole }) => Promise<{ ok: boolean; error?: string }>;
  removeUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser]           = useState<AppUser | null>(null);
  const [pendingSuperadmin, setPendingSuperadmin] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading]               = useState(true);
  const [users, setUsers]                       = useState<AppUser[]>([]);

  // Restore session from the httpOnly cookie via the server, and load the user list.
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.ok ? r.json() : { user: null }),
      fetch("/api/auth/users").then(r => r.ok ? r.json() : []),
    ]).then(([session, userList]) => {
      setCurrentUser((session as { user: AppUser | null }).user ?? null);
      setUsers(Array.isArray(userList) ? userList : []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as { user?: AppUser; error?: string };

    if (!res.ok) return { ok: false, error: data.error ?? "Incorrect email or password." };

    const user = data.user!;
    if (user.role === "superadmin") {
      setPendingSuperadmin(user);
      return { ok: true, requiresConfirm: true };
    }

    setCurrentUser(user);
    return { ok: true };
  }, []);

  const confirmSuperadmin = useCallback(() => {
    if (!pendingSuperadmin) return;
    setCurrentUser(pendingSuperadmin);
    setPendingSuperadmin(null);
  }, [pendingSuperadmin]);

  const cancelSuperadmin = useCallback(async () => {
    setPendingSuperadmin(null);
    await fetch("/api/auth/logout", { method: "POST" });
  }, []);

  const logout = useCallback(async () => {
    setCurrentUser(null);
    setPendingSuperadmin(null);
    await fetch("/api/auth/logout", { method: "POST" });
  }, []);

  const addUser = useCallback(async (data: { name: string; email: string; password: string; role: UserRole }) => {
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json() as { user?: AppUser; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? "Failed to add user." };
    if (json.user) setUsers(prev => [...prev, json.user!]);
    return { ok: true };
  }, []);

  const removeUser = useCallback(async (userId: string) => {
    if (currentUser?.id === userId) return { ok: false, error: "You cannot remove your own account." };
    const res = await fetch(`/api/auth/users/${userId}`, { method: "DELETE" });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? "Could not remove user." };
    setUsers(prev => prev.filter(u => u.id !== userId));
    return { ok: true };
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{
      currentUser, users, isLoading, pendingSuperadmin,
      login, confirmSuperadmin, cancelSuperadmin, logout, addUser, removeUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
