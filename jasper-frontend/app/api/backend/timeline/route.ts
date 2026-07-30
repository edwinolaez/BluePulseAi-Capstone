import { NextRequest, NextResponse } from "next/server";

const FEVEN_API  = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ML_API_KEY = process.env.ML_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const sectorId = new URL(req.url).searchParams.get("sector_id");
  if (!sectorId) return NextResponse.json({ error: "sector_id required" }, { status: 400 });

  const upstream = `${FEVEN_API}/api/v1/sectors/${encodeURIComponent(sectorId)}/timeline`;
  const res = await fetch(upstream, { headers: { "X-API-Key": ML_API_KEY } });
  return NextResponse.json(await res.json(), { status: res.status });
}
