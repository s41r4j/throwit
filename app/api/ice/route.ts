import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function list(value: string | undefined, fallback: string[]): string[] {
  const items = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items?.length ? items : fallback;
}

export async function GET() {
  const iceServers: RTCIceServer[] = [
    {
      urls: list(process.env.STUN_URLS, ["stun:stun.l.google.com:19302"]),
    },
  ];

  const turnUrls = list(process.env.TURN_URLS, []);
  const turnSecret = process.env.TURN_SHARED_SECRET;

  if (turnUrls.length && turnSecret) {
    const ttl = Math.min(
      Math.max(Number(process.env.TURN_TTL_SECONDS || 3600), 300),
      86_400,
    );
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expires}:${randomUUID().slice(0, 12)}`;
    const credential = createHmac("sha1", turnSecret).update(username).digest("base64");

    iceServers.push({
      urls: turnUrls,
      username,
      credential,
      credentialType: "password",
    });
  }

  return NextResponse.json(
    { iceServers },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
