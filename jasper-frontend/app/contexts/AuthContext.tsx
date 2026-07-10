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

interface StoredUser extends AppUser {
  password: string;
}

// ── Seed accounts (demo only — production would use Feven's backend auth) ──
const SEED_USERS: StoredUser[] = [
  { id: "u1", name: "Dr. Eleanor Vance",  email: "researcher@jasper.ca",  password: "Research@2024", role: "researcher", createdAt: "2024-06-01" },
  { id: "u2", name: "Edwin Park",          email: "admin@jasper.ca",       password: "Admin@2024",    role: "admin",       createdAt: "2024-06-01" },
  { id: "u3", name: "System Administrator",email: "superadmin@jasper.ca",  password: "Super@2024",    role: "superadmin",  createdAt: "2024-06-01" },
];

const USERS_KEY   = "jasper_users_v2";
const SESSION_KEY = "jasper_session";

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : SEED_USERS;
  } catch { return SEED_USERS; }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toPublic(u: StoredUser): AppUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

function loadSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(user: AppUser | null) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_KEY);
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  currentUser: AppUser | null;
  users: AppUser[];
  isLoading: boolean;
  pendingSuperadmin: AppUser | null;    // set when superadmin is mid-login (awaiting confirm)
  login: (email: string, password: string) => { ok: boolean; error?: string; requiresConfirm?: boolean };
  confirmSuperadmin: () => void;        // called after user clicks "Confirm & Sign In"
  cancelSuperadmin: () => void;
  logout: () => void;
  addUser: (data: { name: string; email: string; password: string; role: UserRole }) => { ok: boolean; error?: string };
  removeUser: (userId: string) => { ok: boolean; error?: string };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser]         = useState<AppUser | null>(null);
  const [pendingSuperadmin, setPendingSuperadmin] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading]             = useState(true);
  const [users, setUsers]                     = useState<AppUser[]>([]);

  // Initialise from storage on mount
  useEffect(() => {
    const stored = loadUsers();
    setUsers(stored.map(toPublic));
    const session = loadSession();
    setCurrentUser(session);
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, password: string) => {
    const all = loadUsers();
    const found = all.find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    );
    if (!found) return { ok: false, error: "Incorrect email or password." };

    const safe = toPublic(found);

    if (safe.role === "superadmin") {
      // Don't log in immediately — require modal confirmation
      setPendingSuperadmin(safe);
      return { ok: true, requiresConfirm: true };
    }

    setCurrentUser(safe);
    saveSession(safe);
    return { ok: true };
  }, []);

  const confirmSuperadmin = useCallback(() => {
    if (!pendingSuperadmin) return;
    setCurrentUser(pendingSuperadmin);
    saveSession(pendingSuperadmin);
    setPendingSuperadmin(null);
  }, [pendingSuperadmin]);

  const cancelSuperadmin = useCallback(() => {
    setPendingSuperadmin(null);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setPendingSuperadmin(null);
    saveSession(null);
  }, []);

  const addUser = useCallback((data: { name: string; email: string; password: string; role: UserRole }) => {
    const all = loadUsers();
    if (all.some((u) => u.email.toLowerCase() === data.email.toLowerCase().trim())) {
      return { ok: false, error: "An account with that email already exists." };
    }
    const newUser: StoredUser = {
      id: `u${Date.now()}`,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password: data.password,
      role: data.role,
      createdAt: new Date().toISOString().split("T")[0],
    };
    const updated = [...all, newUser];
    saveUsers(updated);
    setUsers(updated.map(toPublic));
    return { ok: true };
  }, []);

  const removeUser = useCallback((userId: string) => {
    if (currentUser?.id === userId) return { ok: false, error: "You cannot remove your own account." };
    const all = loadUsers();
    const target = all.find((u) => u.id === userId);
    if (!target) return { ok: false, error: "User not found." };
    if (target.role === "superadmin" && all.filter((u) => u.role === "superadmin").length === 1) {
      return { ok: false, error: "Cannot remove the last superadmin account." };
    }
    const updated = all.filter((u) => u.id !== userId);
    saveUsers(updated);
    setUsers(updated.map(toPublic));
    return { ok: true };
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, users, isLoading, pendingSuperadmin, login, confirmSuperadmin, cancelSuperadmin, logout, addUser, removeUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
