import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeNetworkAddress } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientAddress(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "local-development"
  );
}

function cleanPrivateSpace(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 48);
  return clean.length >= 4 ? clean : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.NETWORK_TOKEN_SECRET;
  if (!secret || secret.length < 24) {
    return NextResponse.json(
      { error: "NETWORK_TOKEN_SECRET is missing or too short" },
      { status: 500 },
    );
  }

  let space: string | null = null;
  try {
    const body = (await request.json()) as { space?: unknown };
    space = cleanPrivateSpace(body.space);
  } catch {
    // An empty or invalid body means automatic grouping.
  }

  const now = new Date();
  const dayBucket = now.toISOString().slice(0, 10);
  const normalizedAddress = normalizeNetworkAddress(getClientAddress(request));
  const scope = space ? `private:${space}` : `automatic:${normalizedAddress}`;

  const id = createHmac("sha256", secret)
    .update(`throwit:v1:${dayBucket}:${scope}`)
    .digest("base64url")
    .slice(0, 32);

  const expiresAt = new Date(now);
  expiresAt.setUTCHours(24, 0, 0, 0);

  return NextResponse.json(
    {
      id,
      mode: space ? "private" : "automatic",
      expiresAt: expiresAt.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
