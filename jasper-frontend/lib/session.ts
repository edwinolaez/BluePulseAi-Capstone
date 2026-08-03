// Server-only session signing — never import this from a "use client" component.
import { createHmac, timingSafeEqual } from "crypto";
import type { PublicUser } from "./auth-store";

const SECRET =
  process.env.AUTH_SESSION_SECRET ?? "jasper-session-dev-secret-change-in-production";

export const SESSION_COOKIE = "jasper_auth";
export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export function signSession(user: PublicUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string): PublicUser | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PublicUser;
  } catch {
    return null;
  }
}
