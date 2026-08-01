import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { redis } from "@/lib/redis";

export type DeviceKind = "desktop" | "mobile" | "tablet" | "unknown";
export type Device = { id: string; name: string; kind: DeviceKind };
export type SignalPayload = { description?: unknown; candidate?: unknown };

type Connection = {
  connectionId: string;
  peerId: string;
  name: string;
  kind: DeviceKind;
  network: string;
  joined: boolean;
  messages: number;
  windowStartedAt: number;
};

type SignalEnvelope = {
  origin: string;
  network: string;
  from: string;
  to: string;
  signal: SignalPayload;
};

type Hub = {
  instanceId: string;
  conns: Map<WebSocket, Connection>;
  subscriber: ReturnType<NonNullable<typeof redis>["duplicate"]> | null;
  subscriberStarting: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
  presence: ReturnType<typeof setInterval> | null;
};

const globalHub = globalThis as typeof globalThis & { __throwitHub?: Hub };
const hub: Hub = globalHub.__throwitHub ?? {
  instanceId: randomUUID(),
  conns: new Map(),
  subscriber: null,
  subscriberStarting: false,
  heartbeat: null,
  presence: null,
};
globalHub.__throwitHub = hub;

const CONNECTION_TTL_MS = 35_000;
const HEARTBEAT_MS = 10_000;
const PRESENCE_MS = 3_000;
const KEY_TTL_SECONDS = 120;
const SIGNAL_PREFIX = "throwit:signal:";
const PRESENCE_PREFIX = "throwit:presence-changed:";

const presenceKey = (network: string) => `throwit:presence:${network}`;
const metadataKey = (network: string) => `throwit:metadata:${network}`;
const signalChannel = (network: string) => `${SIGNAL_PREFIX}${network}`;
const presenceChannel = (network: string) => `${PRESENCE_PREFIX}${network}`;

function send(ws: WebSocket, event: object) {
  if (ws.readyState === 1) ws.send(JSON.stringify(event));
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 48;
}

function validKind(value: unknown): value is DeviceKind {
  return value === "desktop" || value === "mobile" || value === "tablet" || value === "unknown";
}

function localConnections(network: string) {
  return [...hub.conns.entries()].filter(([, conn]) => conn.joined && conn.network === network);
}

async function touch(conn: Connection) {
  if (!redis || !conn.joined) return;
  const now = Date.now();
  const metadata = JSON.stringify({
    connectionId: conn.connectionId,
    peerId: conn.peerId,
    name: conn.name,
    kind: conn.kind,
    instanceId: hub.instanceId,
  });
  const pipeline = redis.pipeline();
  pipeline.zadd(presenceKey(conn.network), now, conn.connectionId);
  pipeline.hset(metadataKey(conn.network), conn.connectionId, metadata);
  pipeline.expire(presenceKey(conn.network), KEY_TTL_SECONDS);
  pipeline.expire(metadataKey(conn.network), KEY_TTL_SECONDS);
  await pipeline.exec();
}

async function removeFromRedis(conn: Connection) {
  if (!redis || !conn.joined) return;
  const pipeline = redis.pipeline();
  pipeline.zrem(presenceKey(conn.network), conn.connectionId);
  pipeline.hdel(metadataKey(conn.network), conn.connectionId);
  await pipeline.exec();
  await redis.publish(presenceChannel(conn.network), hub.instanceId);
}

async function networkPeers(network: string): Promise<Array<Device & { connectionId: string }>> {
  if (!redis) {
    return localConnections(network).map(([, conn]) => ({
      id: conn.peerId,
      name: conn.name,
      kind: conn.kind,
      connectionId: conn.connectionId,
    }));
  }

  const cutoff = Date.now() - CONNECTION_TTL_MS;
  await redis.zremrangebyscore(presenceKey(network), 0, cutoff);
  const ids = await redis.zrange(presenceKey(network), 0, -1);
  if (!ids.length) return [];
  const values = await redis.hmget(metadataKey(network), ...ids);
  const peers: Array<Device & { connectionId: string }> = [];
  for (const value of values) {
    if (!value) continue;
    try {
      const parsed = JSON.parse(value) as {
        connectionId: string;
        peerId: string;
        name: string;
        kind: DeviceKind;
      };
      if (validId(parsed.peerId) && validName(parsed.name) && validKind(parsed.kind)) {
        peers.push({
          id: parsed.peerId,
          name: parsed.name,
          kind: parsed.kind,
          connectionId: parsed.connectionId,
        });
      }
    } catch {
      // Ignore malformed or stale metadata.
    }
  }
  return peers;
}

export async function broadcastPresence(network: string) {
  const all = await networkPeers(network);
  const unique = new Map<string, Device & { connectionId: string }>();
  for (const peer of all) unique.set(peer.id, peer);
  for (const [ws, conn] of localConnections(network)) {
    send(ws, {
      type: "peers",
      peers: [...unique.values()]
        .filter((peer) => peer.id !== conn.peerId)
        .map(({ id, name, kind }) => ({ id, name, kind })),
    });
  }
}

async function relayRedisSignal(envelope: SignalEnvelope) {
  if (envelope.origin === hub.instanceId) return;
  for (const [ws, conn] of localConnections(envelope.network)) {
    if (conn.peerId === envelope.to) {
      send(ws, { type: "signal", from: envelope.from, signal: envelope.signal });
    }
  }
}

async function startSubscriber() {
  if (!redis || hub.subscriber || hub.subscriberStarting) return;
  hub.subscriberStarting = true;
  const subscriber = redis.duplicate();
  hub.subscriber = subscriber;
  subscriber.on("pmessage", (_pattern, channel, payload) => {
    if (channel.startsWith(SIGNAL_PREFIX)) {
      try {
        void relayRedisSignal(JSON.parse(payload) as SignalEnvelope);
      } catch {
        // Ignore malformed cross-instance messages.
      }
      return;
    }
    if (channel.startsWith(PRESENCE_PREFIX)) {
      const network = channel.slice(PRESENCE_PREFIX.length);
      if (network) void broadcastPresence(network);
    }
  });
  try {
    await subscriber.psubscribe(`${SIGNAL_PREFIX}*`, `${PRESENCE_PREFIX}*`);
  } finally {
    hub.subscriberStarting = false;
  }
}

function activeNetworks() {
  return [...new Set([...hub.conns.values()].filter((conn) => conn.joined).map((conn) => conn.network))];
}

function startTimers() {
  if (!hub.heartbeat) {
    hub.heartbeat = setInterval(() => {
      for (const conn of hub.conns.values()) if (conn.joined) void touch(conn);
    }, HEARTBEAT_MS);
  }
  if (!hub.presence) {
    hub.presence = setInterval(() => {
      for (const network of activeNetworks()) void broadcastPresence(network);
    }, PRESENCE_MS);
  }
  void startSubscriber();
}

async function stopInfrastructureIfIdle() {
  if (hub.conns.size) return;
  if (hub.heartbeat) clearInterval(hub.heartbeat);
  if (hub.presence) clearInterval(hub.presence);
  hub.heartbeat = null;
  hub.presence = null;
  const subscriber = hub.subscriber;
  hub.subscriber = null;
  if (subscriber) await subscriber.quit().catch(() => undefined);
}

export function register(ws: WebSocket, network: string) {
  hub.conns.set(ws, {
    connectionId: randomUUID(),
    peerId: "",
    name: "",
    kind: "unknown",
    network,
    joined: false,
    messages: 0,
    windowStartedAt: Date.now(),
  });
  startTimers();
}

export async function join(ws: WebSocket, peer: Device) {
  const conn = hub.conns.get(ws);
  if (!conn) return;
  if (!peer || !validId(peer.id) || !validName(peer.name) || !validKind(peer.kind)) {
    ws.close(1008, "invalid peer");
    return;
  }
  conn.peerId = peer.id;
  conn.name = peer.name.trim();
  conn.kind = peer.kind;
  conn.joined = true;
  await touch(conn);
  send(ws, { type: "ready", selfId: conn.peerId });
  if (redis) await redis.publish(presenceChannel(conn.network), hub.instanceId);
  await broadcastPresence(conn.network);
}

export function overRateLimit(ws: WebSocket) {
  const conn = hub.conns.get(ws);
  if (!conn) return true;
  const now = Date.now();
  if (now - conn.windowStartedAt > 10_000) {
    conn.windowStartedAt = now;
    conn.messages = 0;
  }
  conn.messages += 1;
  return conn.messages > 180;
}

export async function relaySignal(ws: WebSocket, to: string, signal: SignalPayload) {
  const conn = hub.conns.get(ws);
  if (!conn?.joined || !validId(to) || to === conn.peerId) return;

  for (const [targetSocket, target] of localConnections(conn.network)) {
    if (target.peerId === to) {
      send(targetSocket, { type: "signal", from: conn.peerId, signal });
    }
  }

  if (redis) {
    const envelope: SignalEnvelope = {
      origin: hub.instanceId,
      network: conn.network,
      from: conn.peerId,
      to,
      signal,
    };
    await redis.publish(signalChannel(conn.network), JSON.stringify(envelope));
  }
}

export async function unregister(ws: WebSocket) {
  const conn = hub.conns.get(ws);
  if (!conn) return;
  hub.conns.delete(ws);
  await removeFromRedis(conn);
  await broadcastPresence(conn.network);
  await stopInfrastructureIfIdle();
}
