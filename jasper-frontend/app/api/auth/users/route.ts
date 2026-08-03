import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, addUser } from "@/lib/auth-store";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import type { UserRole } from "@/lib/auth-store";

function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json([], { status: 401 });
  return NextResponse.json(getAllUsers());
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { name, email, password, role } = (body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
  };

  if (!name?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = addUser({ name, email, password, role });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ user: result.user }, { status: 201 });
}
