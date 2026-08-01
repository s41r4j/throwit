import { createHash } from "node:crypto";
import {
  experimental_upgradeWebSocket,
  type WebSocketData,
} from "@vercel/functions";
import {
  join,
  overRateLimit,
  register,
  relaySignal,
  unregister,
  type Device,
  type SignalPayload,
} from "@/lib/signaling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ClientEvent =
  | { type: "hello"; peer: Device }
  | { type: "signal"; to: string; signal: SignalPayload }
  | { type: "ping" };

function networkKey(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "local-development";
  const first = forwarded.split(",")[0]?.trim() || "local-development";
  const normalized = first.includes(":")
    ? first.split(":").slice(0, 4).join(":")
    : first;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function GET(request: Request) {
  const network = networkKey(request);
  return experimental_upgradeWebSocket((ws) => {
    register(ws, network);

    ws.on("message", (data: WebSocketData) => {
      if (data.toString().length > 64 * 1024 || overRateLimit(ws)) {
        ws.close(1013, "rate limit");
        return;
      }

      let event: ClientEvent;
      try {
        event = JSON.parse(data.toString()) as ClientEvent;
      } catch {
        return;
      }

      if (event.type === "hello") void join(ws, event.peer);
      if (event.type === "signal") void relaySignal(ws, event.to, event.signal);
      if (event.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
    });

    const close = () => void unregister(ws);
    ws.on("close", close);
    ws.on("error", close);
  });
}
