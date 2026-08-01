import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

export type DeviceKind = "desktop" | "mobile" | "tablet" | "unknown";
export type Device = { id: string; name: string; kind: DeviceKind };

type Presence = Device & { seen: number };
type SignalEnvelope = { from: string; signal: unknown; createdAt: number };

const PEER_TTL_MS = 12_000;
const KEY_TTL_SECONDS = 45;
const SPACE_PATTERN = /^[a-z0-9-]{16,64}$/;

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Add an Upstash Redis integration in Vercel to enable device discovery.");
  }
  return new Redis({ url, token });
}

function validPeer(peer: Device) {
  return Boolean(
    peer &&
      /^[a-zA-Z0-9_-]{12,64}$/.test(peer.id) &&
      typeof peer.name === "string" &&
      peer.name.trim().length > 0 &&
      peer.name.trim().length <= 48 &&
      ["desktop", "mobile", "tablet", "unknown"].includes(peer.kind),
  );
}

function cleanSpace(space?: string | null) {
  const value = space?.trim().toLowerCase() || "";
  return SPACE_PATTERN.test(value) ? value : null;
}

function normalizeAddress(raw: string) {
  let value = raw.trim().toLowerCase();
  const bracketed = value.match(/^\[([0-9a-f:]+)](?::\d+)?$/i);
  if (bracketed) value = bracketed[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value.includes(":")) return value.split(":").slice(0, 4).join(":");
  return value;
}

function networkScope(headers: Headers, space?: string | null) {
  const sharedSpace = cleanSpace(space);
  if (sharedSpace) {
    return createHash("sha256")
      .update(`throwit:shared:${sharedSpace}`)
      .digest("hex")
      .slice(0, 28);
  }

  const forwarded =
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for") ||
    headers.get("x-real-ip") ||
    "local-development";
  const first = forwarded.split(",")[0]?.trim() || "local-development";
  const normalized = normalizeAddress(first);
  return createHash("sha256")
    .update(`throwit:network:${normalized}`)
    .digest("hex")
    .slice(0, 28);
}

const presenceKey = (scope: string) => `throwit:v4:presence:${scope}`;
const signalKey = (scope: string, peer: string) => `throwit:v4:signal:${scope}:${peer}`;

export async function heartbeat(
  headers: Headers,
  peer: Device,
  space?: string | null,
): Promise<Device[]> {
  if (!validPeer(peer)) throw new Error("Invalid device identity.");
  const redis = getRedis();
  const scope = networkScope(headers, space);
  const key = presenceKey(scope);
  const now = Date.now();

  await redis.hset(key, {
    [peer.id]: JSON.stringify({ ...peer, name: peer.name.trim(), seen: now }),
  });
  await redis.expire(key, KEY_TTL_SECONDS);

  const all = (await redis.hgetall<Record<string, string>>(key)) || {};
  const active: Presence[] = [];
  const stale: string[] = [];

  for (const [id, value] of Object.entries(all)) {
    try {
      const parsed =
        typeof value === "string"
          ? (JSON.parse(value) as Presence)
          : (value as unknown as Presence);
      if (now - parsed.seen <= PEER_TTL_MS) active.push(parsed);
      else stale.push(id);
    } catch {
      stale.push(id);
    }
  }

  if (stale.length) await redis.hdel(key, ...stale);
  return active
    .filter((item) => item.id !== peer.id)
    .map(({ id, name, kind }) => ({ id, name, kind }));
}

export async function pushSignal(
  headers: Headers,
  from: string,
  to: string,
  signal: unknown,
  space?: string | null,
) {
  if (!/^[a-zA-Z0-9_-]{12,64}$/.test(from) || !/^[a-zA-Z0-9_-]{12,64}$/.test(to)) {
    throw new Error("Invalid signal target.");
  }
  const redis = getRedis();
  const key = signalKey(networkScope(headers, space), to);
  const envelope: SignalEnvelope = { from, signal, createdAt: Date.now() };
  await redis.rpush(key, JSON.stringify(envelope));
  await redis.expire(key, 30);
}

export async function pullSignals(
  headers: Headers,
  peer: string,
  space?: string | null,
): Promise<SignalEnvelope[]> {
  if (!/^[a-zA-Z0-9_-]{12,64}$/.test(peer)) return [];
  const redis = getRedis();
  const key = signalKey(networkScope(headers, space), peer);
  const values = await redis.lrange<string>(key, 0, 49);
  if (values.length) await redis.ltrim(key, values.length, -1);
  return values.flatMap((value) => {
    try {
      return [
        typeof value === "string"
          ? (JSON.parse(value) as SignalEnvelope)
          : (value as unknown as SignalEnvelope),
      ];
    } catch {
      return [];
    }
  });
}
