import { NextRequest, NextResponse } from "next/server";
import { heartbeat, type Device } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let peer: Device;
  let space: string | null = null;

  try {
    const body = (await request.json()) as
      | Device
      | { peer?: Device; space?: string | null };
    if ("peer" in body) {
      if (!body.peer) throw new Error("Missing peer");
      peer = body.peer;
      space = body.space || null;
    } else {
      peer = body;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const peers = await heartbeat(request.headers, peer, space);
    return NextResponse.json({ peers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Presence unavailable" },
      { status: 503 },
    );
  }
}
