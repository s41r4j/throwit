import { NextRequest, NextResponse } from "next/server";
import { heartbeat } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Device = {
  id: string;
  name: string;
  kind: "desktop" | "mobile" | "tablet" | "unknown";
};

export async function POST(request: NextRequest) {
  let peer: Device;
  try {
    peer = (await request.json()) as Device;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const peers = await heartbeat(request.headers, peer);
    return NextResponse.json({ peers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Presence unavailable" },
      { status: 503 },
    );
  }
}
