import { NextRequest, NextResponse } from "next/server";

const ML_API     = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ML_API_KEY = process.env.ML_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const params = new URLSearchParams({
    sector_id:           sp.get("sector_id")           ?? "",
    flow_direction_deg:  sp.get("flow_direction_deg")  ?? "",
    water_velocity_ms:   sp.get("water_velocity_ms")   ?? "",
    contamination_level: sp.get("contamination_level") ?? "",
  });
  const res = await fetch(`${ML_API}/api/v1/simulate/contaminant?${params}`, {
    headers: { "X-API-Key": ML_API_KEY },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
