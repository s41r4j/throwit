import { NextRequest, NextResponse } from "next/server";
import { pullSignals, pushSignal } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { from?: string; to?: string; signal?: unknown };
    if (!body.from || !body.to || !body.signal) {
      return NextResponse.json({ error: "Invalid signal" }, { status: 400 });
    }
    await pushSignal(request.headers, body.from, body.to, body.signal);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signaling unavailable" },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest) {
  const peer = request.nextUrl.searchParams.get("peer") || "";
  if (!peer) return NextResponse.json({ signals: [] });
  try {
    const signals = await pullSignals(request.headers, peer);
    return NextResponse.json({ signals }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signaling unavailable" },
      { status: 503 },
    );
  }
}
