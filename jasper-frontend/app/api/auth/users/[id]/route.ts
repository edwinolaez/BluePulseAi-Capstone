import { NextRequest, NextResponse } from "next/server";
import { removeUser } from "@/lib/auth-store";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

function getSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession(req);
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
  if (session.id === params.id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  const result = removeUser(params.id);
  if (!result.ok) {
    const status = result.error === "User not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
