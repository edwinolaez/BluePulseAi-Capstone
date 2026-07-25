import { NextRequest, NextResponse } from "next/server";

const FEVEN_API  = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ML_API_KEY = process.env.ML_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const sectorId = sp.get("sector_id");
  if (!sectorId) return NextResponse.json({ error: "sector_id required" }, { status: 400 });

  const params = new URLSearchParams({
    date_from:  sp.get("date_from")  ?? "",
    date_to:    sp.get("date_to")    ?? "",
    layer_type: sp.get("layer_type") ?? "",
  });
  const upstream = `${FEVEN_API}/api/v1/layers/${encodeURIComponent(sectorId)}?${params}`;
  const res = await fetch(upstream, { headers: { "X-API-Key": ML_API_KEY } });
  return NextResponse.json(await res.json(), { status: res.status });
}
