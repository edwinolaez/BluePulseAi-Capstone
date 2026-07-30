import { NextRequest, NextResponse } from "next/server";

const ML_API     = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ML_API_KEY = process.env.ML_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${ML_API}/api/v1/predict/change-detection`, {
    method:  "POST",
    headers: { "X-API-Key": ML_API_KEY, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
