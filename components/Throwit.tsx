"use client";

import Image from "next/image";
import {
  FormEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Device = {
  id: string;
  name: string;
  kind: "desktop" | "mobile" | "tablet" | "unknown";
};

type Signal = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type Wire =
  | { type: "text"; id: string; text: string }
  | { type: "file"; id: string; name: string; size: number; mime: string }
  | { type: "accept"; id: string; accepted: boolean }
  | { type: "end"; id: string };

type Chat = { id: string; peer: string; mine: boolean; text: string; createdAt: number };
type Offer = { peer: string; id: string; name: string; size: number; mime: string };
type Incoming = Offer & { chunks: ArrayBuffer[]; received: number };
type SavedFile = {
  id: string;
  peer: string;
  name: string;
  url: string;
  size: number;
  mime: string;
  createdAt: number;
};

type Toast = { id: number; title: string; detail?: string; tone?: "default" | "success" | "warning" };

const CHUNK = 64 * 1024;
const LIMIT = 512 * 1024 * 1024;
const PUBLIC_ORIGIN = "https://throwit.s41r4j.in";
const SPACE_PATTERN = /^[a-z0-9-]{16,64}$/;
const HOTSPOT_SPACE_KEY = "throwit-hotspot-space";
const HOTSPOT_ENABLED_KEY = "throwit-hotspot-enabled";
const CYBER_PREFIXES = [
  "Cipher",
  "Shadow",
  "Packet",
  "Kernel",
  "Zero",
  "Neon",
  "Proxy",
  "Quantum",
  "Root",
  "Stealth",
  "Hex",
  "Phantom",
];
const CYBER_SUFFIXES = [
  "Raven",
  "Fox",
  "Warden",
  "Ghost",
  "Falcon",
  "Sentinel",
  "Viper",
  "Beacon",
  "Specter",
  "Node",
  "Shield",
  "Byte",
];

const uid = () => crypto.randomUUID().replaceAll("-", "");

function bytes(size: number) {
  if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

function fileType(name: string, mime = "") {
  const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
  if (mime.startsWith("image/")) return `${extension || "Image"} image`;
  if (mime.startsWith("video/")) return `${extension || "Video"} video`;
  if (mime.startsWith("audio/")) return `${extension || "Audio"} audio`;
  if (mime === "application/pdf" || extension === "PDF") return "PDF document";
  if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(extension || "")) return `${extension} archive`;
  if (["TXT", "MD", "DOC", "DOCX", "CSV", "JSON"].includes(extension || "")) return `${extension} document`;
  return extension ? `${extension} file` : "Secure file";
}

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function cyberName(seed: string) {
  const value = hash(seed);
  const prefix = CYBER_PREFIXES[value % CYBER_PREFIXES.length];
  const suffix = CYBER_SUFFIXES[Math.floor(value / CYBER_PREFIXES.length) % CYBER_SUFFIXES.length];
  return `${prefix} ${suffix}`;
}

function identity(): Device {
  const userAgent = navigator.userAgent;
  const kind = /iPad|Tablet/i.test(userAgent)
    ? "tablet"
    : /iPhone|Android|Mobile/i.test(userAgent)
      ? "mobile"
      : "desktop";
  const savedId = sessionStorage.getItem("throwit-peer-id") || uid();
  sessionStorage.setItem("throwit-peer-id", savedId);
  return { id: savedId, name: cyberName(savedId), kind };
}

function initialHotspotState() {
  if (typeof window === "undefined") return { enabled: false, space: null as string | null };
  const querySpace = new URLSearchParams(window.location.search).get("space")?.trim().toLowerCase() || "";
  if (SPACE_PATTERN.test(querySpace)) {
    localStorage.setItem(HOTSPOT_SPACE_KEY, querySpace);
    localStorage.setItem(HOTSPOT_ENABLED_KEY, "1");
    return { enabled: true, space: querySpace };
  }
  const saved = localStorage.getItem(HOTSPOT_SPACE_KEY) || "";
  const enabled = localStorage.getItem(HOTSPOT_ENABLED_KEY) === "1" && SPACE_PATTERN.test(saved);
  return { enabled, space: enabled ? saved : null };
}

function CyberIcon({ seed }: { seed: string }) {
  const index = hash(seed) % 8;
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (index === 0) return <svg {...common}><path d="M12 3 20 6v5c0 5.2-3.3 8.3-8 10-4.7-1.7-8-4.8-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>;
  if (index === 1) return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></svg>;
  if (index === 2) return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M12 15h5"/></svg>;
  if (index === 3) return <svg {...common}><path d="M8 10V8a4 4 0 1 1 8 0v2"/><rect x="5" y="10" width="14" height="11" rx="3"/><circle cx="12" cy="15" r="1"/><path d="M12 16v2"/></svg>;
  if (index === 4) return <svg {...common}><path d="M8 8h8l2 4-2 7H8l-2-7 2-4Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M4 12h3M17 12h3M5 17l3-1M19 17l-3-1"/></svg>;
  if (index === 5) return <svg {...common}><path d="M8.5 12a3.5 3.5 0 1 1 7 0c0 4-1.7 6.6-4.2 8"/><path d="M6 12a6 6 0 0 1 12 0c0 2-.4 4-1.3 5.8M4 12a8 8 0 0 1 16 0M10 12c0 2-.4 3.5-1.5 5"/></svg>;
  if (index === 6) return <svg {...common}><path d="M7 15 4 20l5-2M17 15l3 5-5-2"/><circle cx="12" cy="9" r="5"/><path d="M12 4V1M7.5 6 5 4M16.5 6 19 4"/></svg>;
  return <svg {...common}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 11 7.2-3.8M8.3 13l7.2 3.8"/></svg>;
}

function inlineMarkdown(value: string): ReactNode[] {
  const matcher = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s<]+)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(value))) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code className="inline-code" key={`${match.index}-code`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const parts = token.match(/^\[([^\]]+)]\((https?:\/\/[^)]+)\)$/);
      if (parts) nodes.push(<a key={`${match.index}-link`} href={parts[2]} target="_blank" rel="noreferrer">{parts[1]}</a>);
    } else {
      nodes.push(<a key={`${match.index}-url`} href={token} target="_blank" rel="noreferrer">{token}</a>);
    }
    cursor = matcher.lastIndex;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function MarkdownMessage({ text, onCopy }: { text: string; onCopy: (value: string, detail: string) => void }) {
  const blocks: ReactNode[] = [];
  const matcher = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushProse = (value: string, key: string) => {
    const lines = value.split("\n");
    lines.forEach((line, index) => {
      const id = `${key}-${index}`;
      if (!line.trim()) {
        blocks.push(<span className="markdown-gap" key={id} />);
      } else if (/^#{1,3}\s/.test(line)) {
        blocks.push(<strong className="markdown-heading" key={id}>{inlineMarkdown(line.replace(/^#{1,3}\s/, ""))}</strong>);
      } else if (/^[-*]\s/.test(line)) {
        blocks.push(<span className="markdown-list" key={id}><i>•</i>{inlineMarkdown(line.replace(/^[-*]\s/, ""))}</span>);
      } else {
        blocks.push(<span className="markdown-line" key={id}>{inlineMarkdown(line)}</span>);
      }
    });
  };

  while ((match = matcher.exec(text))) {
    if (match.index > cursor) pushProse(text.slice(cursor, match.index), `prose-${cursor}`);
    const language = match[1].trim() || "code";
    const code = match[2].replace(/\n$/, "");
    blocks.push(
      <div className="code-block" key={`code-${match.index}`}>
        <div><span>{language}</span><button type="button" onClick={() => onCopy(code, "Code copied")}>Copy</button></div>
        <pre><code>{code}</code></pre>
      </div>,
    );
    cursor = matcher.lastIndex;
  }
  if (cursor < text.length) pushProse(text.slice(cursor), `prose-${cursor}`);
  return <div className="markdown-body">{blocks}</div>;
}

export default function Throwit() {
  const [self] = useState<Device | null>(() => (typeof window === "undefined" ? null : identity()));
  const [hotspot] = useState(initialHotspotState);
  const [hotspotEnabled, setHotspotEnabled] = useState(hotspot.enabled);
  const [space, setSpace] = useState<string | null>(hotspot.space);
  const [peers, setPeers] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing local airspace");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [progress, setProgress] = useState<{ name: string; value: number; direction: "sending" | "receiving" } | null>(null);
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [caughtFile, setCaughtFile] = useState<SavedFile | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [unread, setUnread] = useState(0);

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const channels = useRef(new Map<string, RTCDataChannel>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const outgoing = useRef(new Map<string, { peer: string; file: File }>());
  const incoming = useRef(new Map<string, Incoming>());
  const fileUrls = useRef(new Set<string>());
  const peersRef = useRef<Device[]>([]);
  const modeRef = useRef(mode);
  const selectedRef = useRef(selected);
  const handleDataRef = useRef<(peer: string, event: MessageEvent) => void>(() => undefined);
  const input = useRef<HTMLInputElement | null>(null);
  const radarRef = useRef<HTMLElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const tetherRef = useRef<HTMLDivElement | null>(null);
  const aimPathRef = useRef<SVGPathElement | null>(null);
  const peerRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef({ active: false, pointerId: -1, startX: 0, startY: 0, x: 0, y: 0 });
  const throwingRef = useRef(false);

  const chosen = useMemo(() => peers.find((peer) => peer.id === selected) || null, [peers, selected]);
  const thread = chat.filter((message) => message.peer === selected);
  const received = files.filter((file) => file.peer === selected);

  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { modeRef.current = mode; if (mode === "text") setUnread(0); }, [mode]);
  useEffect(() => { selectedRef.current = selected; if (mode === "text") setUnread(0); }, [selected, mode]);

  const toast = useCallback((title: string, detail?: string, tone: Toast["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items.slice(-2), { id, title, detail, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600);
  }, []);

  const copy = useCallback(async (value: string, message = "Copied") => {
    try {
      await navigator.clipboard.writeText(value);
      toast(message, undefined, "success");
    } catch {
      toast("Clipboard access was blocked", "Copy it manually from the message.", "warning");
    }
  }, [toast]);

  const resetConnections = useCallback(() => {
    channels.current.forEach((channel) => channel.close());
    pcs.current.forEach((pc) => pc.close());
    channels.current.clear();
    pcs.current.clear();
    pendingIce.current.clear();
    setPeers([]);
    setSelected(null);
  }, []);

  const signal = useCallback(async (to: string, payload: Signal) => {
    if (!self) return;
    const response = await fetch("/api/signal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: self.id, to, signal: payload, space: hotspotEnabled ? space : null }),
    });
    if (!response.ok) throw new Error("Signaling unavailable");
  }, [hotspotEnabled, self, space]);

  const closePeer = useCallback((id: string) => {
    channels.current.get(id)?.close();
    pcs.current.get(id)?.close();
    channels.current.delete(id);
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    if (incoming.current.has(id)) {
      incoming.current.delete(id);
      setProgress(null);
    }
  }, []);

  const sendWire = useCallback((peer: string, data: Wire) => {
    const channel = channels.current.get(peer);
    if (!channel || channel.readyState !== "open") throw new Error("not connected");
    channel.send(JSON.stringify(data));
  }, []);

  const bind = useCallback((peer: string, channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channels.current.set(peer, channel);
    channel.onmessage = (event) => handleDataRef.current(peer, event);
    channel.onopen = () => setStatus("Direct encrypted route ready");
    channel.onclose = () => channels.current.delete(peer);
    channel.onerror = () => setStatus("Direct route interrupted");
  }, []);

  const connect = useCallback((peer: string, initiator: boolean) => {
    const existing = pcs.current.get(peer);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    pcs.current.set(peer, pc);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) void signal(peer, { candidate: candidate.toJSON() });
    };
    pc.ondatachannel = ({ channel }) => bind(peer, channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("Direct encrypted route ready");
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(peer);
    };

    if (initiator) {
      bind(peer, pc.createDataChannel("throwit", { ordered: true }));
      void pc.createOffer().then(async (description) => {
        await pc.setLocalDescription(description);
        await signal(peer, { description: pc.localDescription! });
      }).catch(() => closePeer(peer));
    }
    return pc;
  }, [bind, closePeer, signal]);

  const receiveSignal = useCallback(async (from: string, payload: Signal) => {
    const pc = connect(from, false);
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      for (const candidate of pendingIce.current.get(from) || []) await pc.addIceCandidate(candidate);
      pendingIce.current.delete(from);
      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await signal(from, { description: pc.localDescription! });
      }
    }
    if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
      else pendingIce.current.set(from, [...(pendingIce.current.get(from) || []), payload.candidate]);
    }
  }, [connect, signal]);

  const waitChannel = useCallback(async (peer: string) => {
    const current = channels.current.get(peer);
    if (current?.readyState === "open") return current;
    connect(peer, true);
    return new Promise<RTCDataChannel>((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const channel = channels.current.get(peer);
        if (channel?.readyState === "open") {
          clearInterval(timer);
          resolve(channel);
        } else if (Date.now() - started > 15_000) {
          clearInterval(timer);
          reject(new Error("timeout"));
        }
      }, 120);
    });
  }, [connect]);

  const sendFileBytes = useCallback(async (peer: string, id: string, file: File) => {
    const channel = await waitChannel(peer);
    setProgress({ name: file.name, value: 0, direction: "sending" });
    for (let offset = 0; offset < file.size; offset += CHUNK) {
      while (channel.bufferedAmount > 4 * 1024 * 1024) await new Promise((resolve) => setTimeout(resolve, 25));
      channel.send(await file.slice(offset, offset + CHUNK).arrayBuffer());
      setProgress({
        name: file.name,
        value: Math.round((Math.min(file.size, offset + CHUNK) / Math.max(1, file.size)) * 100),
        direction: "sending",
      });
    }
    sendWire(peer, { type: "end", id });
    window.setTimeout(() => setProgress(null), 900);
  }, [sendWire, waitChannel]);

  const handleData = useCallback((peer: string, event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      const transfer = incoming.current.get(peer);
      if (!transfer) return;
      transfer.chunks.push(event.data);
      transfer.received += event.data.byteLength;
      setProgress({
        name: transfer.name,
        value: Math.min(99, Math.round((transfer.received / Math.max(1, transfer.size)) * 100)),
        direction: "receiving",
      });
      return;
    }

    let message: Wire;
    try {
      message = JSON.parse(String(event.data)) as Wire;
    } catch {
      return;
    }

    const sender = peersRef.current.find((item) => item.id === peer)?.name || "Nearby device";

    if (message.type === "text") {
      const safeText = message.text.slice(0, 20_000);
      setChat((items) => [...items, { id: message.id, peer, mine: false, text: safeText, createdAt: Date.now() }]);
      if (modeRef.current !== "text" || selectedRef.current !== peer) setUnread((value) => value + 1);
      toast(`New message from ${sender}`, safeText.replace(/\s+/g, " ").slice(0, 88), "success");
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification(`Throwit · ${sender}`, { body: safeText.slice(0, 120), icon: "/paper-logo.webp" });
      }
    }

    if (message.type === "file") {
      if (message.size < 0 || message.size > LIMIT || incoming.current.has(peer)) {
        try { sendWire(peer, { type: "accept", id: message.id, accepted: false }); } catch { /* peer left */ }
        toast(message.size > LIMIT ? "Incoming file exceeds 512 MB" : "Another file is already arriving", undefined, "warning");
        return;
      }
      setOffer({
        peer,
        id: message.id,
        name: message.name.slice(0, 180) || "Unnamed file",
        size: message.size,
        mime: message.mime.slice(0, 120) || "application/octet-stream",
      });
      toast(`Incoming file from ${sender}`, `${fileType(message.name, message.mime)} · ${bytes(message.size)}`);
    }

    if (message.type === "accept") {
      const item = outgoing.current.get(message.id);
      if (!item) return;
      outgoing.current.delete(message.id);
      if (message.accepted) void sendFileBytes(item.peer, message.id, item.file);
      else toast("File declined", `${sender} did not accept the transfer.`, "warning");
    }

    if (message.type === "end") {
      const item = incoming.current.get(peer);
      if (!item || item.id !== message.id) return;
      incoming.current.delete(peer);
      setProgress(null);
      if (item.received !== item.size) {
        toast("Transfer incomplete", `Received ${bytes(item.received)} of ${bytes(item.size)}.`, "warning");
        return;
      }
      const url = URL.createObjectURL(new Blob(item.chunks, { type: item.mime }));
      fileUrls.current.add(url);
      const saved = { ...item, url, createdAt: Date.now() };
      setFiles((list) => [...list, saved]);
      setCaughtFile(saved);
      toast("File caught successfully", `${item.name} · ${bytes(item.size)}`, "success");
    }
  }, [sendFileBytes, sendWire, toast]);

  useEffect(() => { handleDataRef.current = handleData; }, [handleData]);

  useEffect(() => {
    if (!self) return;
    let stopped = false;
    const peerConnections = pcs.current;
    const createdFileUrls = fileUrls.current;

    const presence = async () => {
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ peer: self, space: hotspotEnabled ? space : null }),
          cache: "no-store",
        });
        const result = (await response.json()) as { peers?: Device[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Discovery unavailable");
        const next = result.peers || [];
        if (!stopped) {
          setPeers(next);
          setSelected((current) => current && next.some((peer) => peer.id === current) ? current : next[0]?.id || null);
          setStatus(next.length
            ? `${next.length} nearby device${next.length === 1 ? "" : "s"} found`
            : hotspotEnabled
              ? "Hotspot space active — waiting for another device"
              : "Waiting for another local device");
        }
      } catch (error) {
        if (!stopped) setStatus(error instanceof Error ? error.message : "Discovery unavailable");
      }
    };

    const pollSignals = async () => {
      try {
        const query = new URLSearchParams({ peer: self.id });
        if (hotspotEnabled && space) query.set("space", space);
        const response = await fetch(`/api/signal?${query.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as { signals?: Array<{ from: string; signal: Signal }> };
        for (const item of result.signals || []) await receiveSignal(item.from, item.signal);
      } catch {
        // Presence status reports backend configuration issues.
      }
    };

    void presence();
    void pollSignals();
    const presenceTimer = window.setInterval(() => void presence(), 2600);
    const signalTimer = window.setInterval(() => void pollSignals(), 600);
    return () => {
      stopped = true;
      clearInterval(presenceTimer);
      clearInterval(signalTimer);
      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();
      createdFileUrls.forEach((url) => URL.revokeObjectURL(url));
      createdFileUrls.clear();
    };
  }, [hotspotEnabled, receiveSignal, self, space]);

  const updateAim = useCallback(() => {
    const radar = radarRef.current;
    const core = coreRef.current;
    const path = aimPathRef.current;
    const target = selected ? peerRefs.current.get(selected) : null;
    if (!radar || !core || !path || !target) {
      path?.setAttribute("d", "");
      return;
    }
    const radarBox = radar.getBoundingClientRect();
    const coreBox = core.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const x1 = coreBox.left + coreBox.width / 2 - radarBox.left;
    const y1 = coreBox.top + coreBox.height / 2 - radarBox.top;
    const x2 = targetBox.left + Math.min(54, targetBox.width / 2) - radarBox.left;
    const y2 = targetBox.top + Math.min(54, targetBox.height / 2) - radarBox.top;
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const bend = Math.min(56, distance * 0.12);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - bend;
    path.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
  }, [selected]);

  useEffect(() => {
    const frame = requestAnimationFrame(updateAim);
    const observer = new ResizeObserver(updateAim);
    if (radarRef.current) observer.observe(radarRef.current);
    window.addEventListener("resize", updateAim);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateAim);
    };
  }, [peers, updateAim]);

  const prepareFile = useCallback((file?: File) => {
    if (!file) return;
    if (file.size > LIMIT) {
      toast("File is too large", "Throwit currently limits browser-memory transfers to 512 MB.", "warning");
      return;
    }
    setLoadedFile(file);
    setMode("file");
    toast("File loaded", `${fileType(file.name, file.type)} · ${bytes(file.size)}`, "success");
  }, [toast]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) setDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      setDragActive(false);
      prepareFile(event.dataTransfer.files[0]);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [prepareFile]);

  function updateUrlSpace(value: string | null) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("space", value);
    else url.searchParams.delete("space");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function enableHotspot() {
    const saved = localStorage.getItem(HOTSPOT_SPACE_KEY) || "";
    const nextSpace = SPACE_PATTERN.test(saved) ? saved : `hotspot-${uid().slice(0, 24)}`;
    localStorage.setItem(HOTSPOT_SPACE_KEY, nextSpace);
    localStorage.setItem(HOTSPOT_ENABLED_KEY, "1");
    setSpace(nextSpace);
    setHotspotEnabled(true);
    updateUrlSpace(nextSpace);
    resetConnections();
    return nextSpace;
  }

  function disableHotspot() {
    localStorage.setItem(HOTSPOT_ENABLED_KEY, "0");
    setHotspotEnabled(false);
    setSpace(null);
    updateUrlSpace(null);
    resetConnections();
    toast("Local mode restored", "Normal same-network discovery is active again.", "success");
  }

  function toggleHotspot() {
    if (hotspotEnabled) disableHotspot();
    else {
      enableHotspot();
      toast("Hotspot space enabled", "Share the link with the other device.", "success");
    }
  }

  async function shareHotspotLink() {
    const activeSpace = hotspotEnabled && space ? space : enableHotspot();
    const link = `${PUBLIC_ORIGIN}/?space=${encodeURIComponent(activeSpace)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Throwit", text: `Join ${self?.name || "my device"} on Throwit`, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast("Hotspot link copied", link, "success");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await navigator.clipboard.writeText(link);
      toast("Hotspot link copied", link, "success");
    }
  }

  async function sendTextTransport() {
    const peer = chosen;
    const value = text.trim();
    if (!peer || !value) return;
    try {
      await waitChannel(peer.id);
      const id = uid();
      const safeText = value.slice(0, 20_000);
      sendWire(peer.id, { type: "text", id, text: safeText });
      setChat((items) => [...items, { id, peer: peer.id, mine: true, text: safeText, createdAt: Date.now() }]);
      setText("");
      toast("Message sent", `Delivered to ${peer.name}`, "success");
    } catch {
      toast("Could not send message", `${peer.name} could not be reached.`, "warning");
    }
  }

  async function throwFileTransport() {
    const peer = chosen;
    const file = loadedFile;
    if (!peer || !file) return;
    try {
      await waitChannel(peer.id);
      const id = uid();
      outgoing.current.set(id, { peer: peer.id, file });
      sendWire(peer.id, { type: "file", id, name: file.name, size: file.size, mime: file.type || "application/octet-stream" });
      toast("Throw launched", `${fileType(file.name, file.type)} · ${bytes(file.size)} · waiting for ${peer.name}`, "success");
    } catch {
      toast("Could not prepare direct route", `${peer.name} may have gone offline.`, "warning");
    }
  }

  function payloadReady() {
    return modeRef.current === "file" ? Boolean(loadedFile) : Boolean(text.trim());
  }

  function dispatchPayload() {
    if (modeRef.current === "file") void throwFileTransport();
    else void sendTextTransport();
  }

  function resetCore() {
    const core = coreRef.current;
    if (!core) return;
    core.style.transform = "";
    core.style.opacity = "";
    core.classList.remove("dragging", "flying");
    if (tetherRef.current) {
      tetherRef.current.style.width = "0px";
      tetherRef.current.style.opacity = "0";
    }
    dragRef.current = { active: false, pointerId: -1, startX: 0, startY: 0, x: 0, y: 0 };
    throwingRef.current = false;
    updateAim();
  }

  function springBack() {
    const core = coreRef.current;
    if (!core) return;
    const { x, y } = dragRef.current;
    const animation = core.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(.98)` },
        { transform: `translate(${-x * 0.12}px, ${-y * 0.12}px) scale(1.02)`, offset: 0.62 },
        { transform: "translate(0, 0) scale(1)" },
      ],
      { duration: 380, easing: "cubic-bezier(.22,.8,.2,1)" },
    );
    animation.finished.finally(() => resetCore());
  }

  function launchToSelected(pullX = -26, pullY = 34, triggerPayload = true) {
    const core = coreRef.current;
    const target = selected ? peerRefs.current.get(selected) : null;
    if (!core || !target || throwingRef.current) return;
    if (triggerPayload && !payloadReady()) {
      toast("Nothing to throw", modeRef.current === "file" ? "Drop or choose a file first." : "Write a message first.", "warning");
      springBack();
      return;
    }

    throwingRef.current = true;
    core.classList.remove("dragging");
    core.classList.add("flying");
    if (tetherRef.current) tetherRef.current.style.opacity = "0";

    const coreBox = core.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const baseX = coreBox.left + coreBox.width / 2 - pullX;
    const baseY = coreBox.top + coreBox.height / 2 - pullY;
    const targetX = targetBox.left + Math.min(54, targetBox.width / 2) - baseX;
    const targetY = targetBox.top + Math.min(54, targetBox.height / 2) - baseY;
    const distance = Math.max(1, Math.hypot(targetX, targetY));
    const normalX = -targetY / distance;
    const normalY = targetX / distance;
    const side = Math.sign(pullX * targetY - pullY * targetX) || 1;
    const arc = Math.min(190, 95 + Math.hypot(pullX, pullY) * 0.8);
    const curveX = targetX * 0.5 + normalX * arc * side;
    const curveY = targetY * 0.5 + normalY * arc * side - 72;

    const animation = core.animate(
      [
        { opacity: 1, transform: `translate(${pullX}px, ${pullY}px) scale(1) rotate(-7deg)` },
        { opacity: 1, transform: `translate(${-pullX * 0.7}px, ${-pullY * 0.7}px) scale(.96) rotate(72deg)`, offset: 0.14 },
        { opacity: 1, transform: `translate(${curveX}px, ${curveY}px) scale(.76) rotate(405deg)`, offset: 0.58 },
        { opacity: .96, transform: `translate(${targetX}px, ${targetY}px) scale(.34) rotate(700deg)`, offset: 0.9 },
        { opacity: 0, transform: `translate(${targetX}px, ${targetY}px) scale(.08) rotate(790deg)` },
      ],
      { duration: 1320, easing: "cubic-bezier(.14,.7,.12,1)", fill: "forwards" },
    );
    target.classList.add("catching");
    if (triggerPayload) window.setTimeout(dispatchPayload, 150);
    animation.finished.finally(() => {
      animation.cancel();
      target.classList.remove("catching");
      resetCore();
    });
  }

  function onCorePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!chosen || throwingRef.current) return;
    dragRef.current = { active: true, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: 0, y: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("dragging");
    if (tetherRef.current) tetherRef.current.style.opacity = "1";
    event.preventDefault();
  }

  function onCorePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    let x = event.clientX - drag.startX;
    let y = event.clientY - drag.startY;
    const distance = Math.hypot(x, y);
    if (distance > 112) {
      const scale = 112 / distance;
      x *= scale;
      y *= scale;
    }
    drag.x = x;
    drag.y = y;
    event.currentTarget.style.transform = `translate(${x}px, ${y}px)`;
    if (tetherRef.current) {
      tetherRef.current.style.width = `${Math.hypot(x, y)}px`;
      tetherRef.current.style.transform = `rotate(${Math.atan2(y, x)}rad)`;
    }
  }

  function onCorePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.active = false;
    if (Math.hypot(drag.x, drag.y) < 16) springBack();
    else launchToSelected(drag.x, drag.y, true);
  }

  function submitText(event: FormEvent) {
    event.preventDefault();
    if (!chosen || !text.trim()) return;
    launchToSelected(28, 38, true);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function answer(accepted: boolean) {
    if (!offer) return;
    if (accepted) {
      incoming.current.set(offer.peer, { ...offer, chunks: [], received: 0 });
      setProgress({ name: offer.name, value: 0, direction: "receiving" });
    }
    try {
      sendWire(offer.peer, { type: "accept", id: offer.id, accepted });
    } catch {
      toast("Sender disconnected", "The incoming request is no longer active.", "warning");
    }
    setOffer(null);
  }

  const offerSender = offer ? peers.find((peer) => peer.id === offer.peer)?.name || "Nearby device" : "";

  return (
    <main className="app">
      <header className="nav">
        <a className="brand" href="/" aria-label="Throwit home">
          <Image src="/paper-logo.webp" width={42} height={42} alt="Throwit paper mascot" priority />
          <span>throwit</span>
        </a>
        <div className="nav-center"><i className={peers.length ? "online" : ""} /><span>{status}</span></div>
        <div className="nav-actions">
          <button className={`network-toggle ${hotspotEnabled ? "active" : ""}`} onClick={toggleHotspot} aria-pressed={hotspotEnabled}>
            <span className="toggle-track"><i /></span>
            <span>{hotspotEnabled ? "Hotspot mode" : "Local mode"}</span>
          </button>
          {hotspotEnabled && <button className="share-link" onClick={() => void shareHotspotLink()}>Share link</button>}
        </div>
      </header>

      <section className="canvas">
        <div className="intro">
          <small>LOCAL AIRSPACE</small>
          <h1>Don&apos;t upload it.<br /><em>Throw it.</em></h1>
          <p>Choose a nearby browser, load a payload, then pull and release the paper.</p>
        </div>

        <section className="radar" ref={radarRef}>
          <div className="orbit o1" /><div className="orbit o2" /><div className="orbit o3" />
          <svg className="aim-layer" aria-hidden="true"><path ref={aimPathRef} /></svg>
          <div className="sling-anchor"><div className="sling-tether" ref={tetherRef} /></div>
          <div
            className="paper-core"
            ref={coreRef}
            onPointerDown={onCorePointerDown}
            onPointerMove={onCorePointerMove}
            onPointerUp={onCorePointerUp}
            onPointerCancel={onCorePointerUp}
            role="button"
            tabIndex={0}
            aria-label="Pull back and release to throw"
          >
            <Image src="/paper-logo.webp" width={190} height={190} alt="" priority draggable={false} />
          </div>
          <div className="core-copy">
            <span className="self-label">THIS DEVICE</span>
            <strong>{self?.name || "Generating identity"}</strong>
            <small>{chosen ? `aimed at ${chosen.name}` : peers.length ? "select a device" : hotspotEnabled ? "share your hotspot link" : "open Throwit nearby"}</small>
          </div>

          <div className="peers">
            {peers.slice(0, 6).map((peer, index) => (
              <button
                key={peer.id}
                ref={(node) => { if (node) peerRefs.current.set(peer.id, node); else peerRefs.current.delete(peer.id); }}
                className={`peer p${index + 1} ${selected === peer.id ? "active" : ""}`}
                onClick={() => setSelected(peer.id)}
              >
                <span className="device-icon"><CyberIcon seed={peer.id} /></span>
                <span className="peer-copy"><strong>{peer.name}</strong><small>{selected === peer.id ? "selected" : `${peer.kind} · available`}</small></span>
              </button>
            ))}
          </div>

          {!peers.length && <div className="searching"><i /><span>{status}</span></div>}
        </section>

        <section className={`dock ${mode === "text" ? "chat-mode" : "file-mode"}`}>
          <div className="dock-tabs">
            <button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}>File</button>
            <button className={mode === "text" ? "active" : ""} onClick={() => { setMode("text"); setUnread(0); }}>Text {unread > 0 && <b>{unread}</b>}</button>
          </div>

          {mode === "file" ? (
            <div className="file-panel">
              <button className="payload-card" onClick={() => input.current?.click()}>
                <span className="payload-icon">{loadedFile ? "↑" : "+"}</span>
                <span><strong>{loadedFile?.name || "Choose or drop a file"}</strong><small>{loadedFile ? `${fileType(loadedFile.name, loadedFile.type)} · ${bytes(loadedFile.size)}` : chosen ? `Ready for ${chosen.name}` : "Select a device when ready"}</small></span>
              </button>
              <input ref={input} hidden type="file" onChange={(event) => { prepareFile(event.target.files?.[0]); event.target.value = ""; }} />
              <div className="file-hint"><span>Drag anywhere to load</span><span>512 MB browser limit</span></div>
              <button className="throw" disabled={!chosen || !loadedFile} onClick={() => launchToSelected(-28, 36, true)}><span>→</span><strong>Throw to {chosen?.name || "device"}</strong></button>
            </div>
          ) : (
            <div className="chat-panel">
              <div className="chat-header">
                <div className="chat-peer-icon">{chosen ? <CyberIcon seed={chosen.id} /> : <span>?</span>}</div>
                <div><strong>{chosen?.name || "Choose a device"}</strong><small>{chosen ? "Temporary encrypted conversation" : "Select a nearby device to begin"}</small></div>
                <span className="chat-status">{chosen ? "P2P" : "OFFLINE"}</span>
              </div>
              <div className="message-list">
                {!thread.length && !received.length && <div className="empty-chat"><Image src="/paper-logo.webp" width={58} height={58} alt="" /><strong>No messages yet</strong><span>Markdown, links, and fenced code blocks are supported.</span></div>}
                {thread.map((item) => (
                  <article key={item.id} className={`message ${item.mine ? "mine" : "theirs"}`}>
                    <div className="message-meta"><span>{item.mine ? "You" : chosen?.name || "Peer"}</span><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
                    <MarkdownMessage text={item.text} onCopy={copy} />
                    <button className="copy-message" type="button" onClick={() => void copy(item.text, "Message copied")}>Copy message</button>
                  </article>
                ))}
                {received.map((file) => (
                  <article key={file.id} className="file-message">
                    <span className="file-message-icon">↓</span>
                    <div><strong>{file.name}</strong><small>{fileType(file.name, file.mime)} · {bytes(file.size)}</small></div>
                    <a href={file.url} download={file.name}>Save</a>
                  </article>
                ))}
              </div>
              <form className="composer" onSubmit={submitText}>
                <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onComposerKeyDown} disabled={!chosen} placeholder={chosen ? "Write a message… Markdown and ```code``` supported" : "Choose a device first"} />
                <div><span>Enter to send · Shift+Enter for newline</span><button disabled={!chosen || !text.trim()} aria-label="Send message">→</button></div>
              </form>
            </div>
          )}
        </section>
      </section>

      <footer><span>made w/ &lt;3</span><a href="https://x.com/s41r4j" target="_blank" rel="noreferrer">@s41r4j</a></footer>

      {dragActive && <div className="drag-overlay"><Image src="/paper-logo.webp" width={112} height={112} alt="" /><strong>Drop it to load</strong><span>The file stays in your browser until you throw it.</span></div>}

      {progress && <div className="progress"><div><span>{progress.direction === "sending" ? "Throwing" : "Catching"}</span><strong>{progress.name}</strong><b>{progress.value}%</b></div><i><span style={{ width: `${progress.value}%` }} /></i></div>}

      {offer && <div className="modal"><section>
        <Image src="/paper-logo.webp" width={88} height={88} alt="" />
        <small>INCOMING THROW</small>
        <h2>{offer.name}</h2>
        <div className="file-details"><span>{fileType(offer.name, offer.mime)}</span><strong>{bytes(offer.size)}</strong><small>From {offerSender} · encrypted WebRTC</small></div>
        <p>Review the file details before accepting. The file is assembled only in this browser.</p>
        <div className="modal-actions"><button onClick={() => answer(false)}>Decline</button><button className="accept" onClick={() => answer(true)}>Catch it</button></div>
      </section></div>}

      {caughtFile && <div className="modal caught-modal"><section>
        <Image src="/paper-logo.webp" width={88} height={88} alt="" />
        <small>CAUGHT SUCCESSFULLY</small>
        <h2>{caughtFile.name}</h2>
        <div className="file-details"><span>{fileType(caughtFile.name, caughtFile.mime)}</span><strong>{bytes(caughtFile.size)}</strong><small>Verified complete in browser memory</small></div>
        <p>Save it now. The temporary browser URL disappears when this tab closes.</p>
        <div className="modal-actions"><button onClick={() => setCaughtFile(null)}>Close</button><a className="accept" href={caughtFile.url} download={caughtFile.name} onClick={() => setCaughtFile(null)}>Save file</a></div>
      </section></div>}

      <div className="toast-stack">{toasts.map((item) => <div key={item.id} className={`toast ${item.tone || "default"}`}><i /><div><strong>{item.title}</strong>{item.detail && <span>{item.detail}</span>}</div></div>)}</div>
    </main>
  );
}
