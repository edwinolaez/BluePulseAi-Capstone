import { NextRequest, NextResponse } from "next/server";

const ML_API     = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ML_API_KEY = process.env.ML_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const params = new URLSearchParams({
    sector_id:   sp.get("sector_id")   ?? "",
    slope_deg:   sp.get("slope_deg")   ?? "",
    rainfall_mm: sp.get("rainfall_mm") ?? "",
  });
  const res = await fetch(`${ML_API}/api/v1/simulate/erosion?${params}`, {
    headers: { "X-API-Key": ML_API_KEY },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
