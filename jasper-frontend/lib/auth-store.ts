// Server-only user store — never import this from a "use client" component.
import { createHash } from "crypto";

export type UserRole = "researcher" | "admin" | "superadmin";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

function hashPassword(password: string): string {
  return createHash("sha256").update(`jasper:${password}:2024`).digest("hex");
}

function toPublic(u: StoredUser): PublicUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

// Module-level store — persists for the lifetime of the server process.
const store = new Map<string, StoredUser>([
  ["u1", { id: "u1", name: "John Doe",      email: "researcher@jasper.ca", passwordHash: hashPassword("Research@2024"), role: "researcher", createdAt: "2024-06-01" }],
  ["u2", { id: "u2", name: "Jane Smith",     email: "admin@jasper.ca",      passwordHash: hashPassword("Admin@2024"),    role: "admin",      createdAt: "2024-06-01" }],
  ["u3", { id: "u3", name: "Robert Johnson", email: "superadmin@jasper.ca", passwordHash: hashPassword("Super@2024"),   role: "superadmin", createdAt: "2024-06-01" }],
]);

function storeValues(): StoredUser[] {
  return Array.from(store.values());
}

export function findByCredentials(email: string, password: string): PublicUser | null {
  const normalised = email.toLowerCase().trim();
  const hash = hashPassword(password);
  const user = storeValues().find(u => u.email === normalised && u.passwordHash === hash);
  return user ? toPublic(user) : null;
}

export function findById(id: string): PublicUser | null {
  const user = store.get(id);
  return user ? toPublic(user) : null;
}

export function getAllUsers(): PublicUser[] {
  return storeValues().map(toPublic);
}

export function addUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): { ok: boolean; error?: string; user?: PublicUser } {
  const email = data.email.toLowerCase().trim();
  if (storeValues().some(u => u.email === email)) {
    return { ok: false, error: "An account with that email already exists." };
  }
  const id = `u${Date.now()}`;
  const newUser: StoredUser = {
    id,
    name: data.name.trim(),
    email,
    passwordHash: hashPassword(data.password),
    role: data.role,
    createdAt: new Date().toISOString().split("T")[0],
  };
  store.set(id, newUser);
  return { ok: true, user: toPublic(newUser) };
}

export function removeUser(userId: string): { ok: boolean; error?: string } {
  const user = store.get(userId);
  if (!user) return { ok: false, error: "User not found." };
  const superadmins = storeValues().filter(u => u.role === "superadmin");
  if (user.role === "superadmin" && superadmins.length === 1) {
    return { ok: false, error: "Cannot remove the last superadmin account." };
  }
  store.delete(userId);
  return { ok: true };
}
