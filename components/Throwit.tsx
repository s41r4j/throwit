"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type Chat = { id: string; peer: string; mine: boolean; text: string };
type Offer = { peer: string; id: string; name: string; size: number; mime: string };
type Incoming = Offer & { chunks: ArrayBuffer[]; received: number };
type SavedFile = { id: string; peer: string; name: string; url: string; size: number };

const CHUNK = 64 * 1024;
const LIMIT = 512 * 1024 * 1024;
const SPACE_PATTERN = /^[a-z0-9-]{16,64}$/;
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
const bytes = (size: number) =>
  size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(size / 1024))} KB`;

function cyberName(seed: string) {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const prefix = CYBER_PREFIXES[hash % CYBER_PREFIXES.length];
  const suffix = CYBER_SUFFIXES[Math.floor(hash / CYBER_PREFIXES.length) % CYBER_SUFFIXES.length];
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

function initialSpace() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("space")?.trim().toLowerCase() || "";
  return SPACE_PATTERN.test(value) ? value : null;
}

export default function Throwit() {
  const [self] = useState<Device | null>(() => (typeof window === "undefined" ? null : identity()));
  const [space, setSpace] = useState<string | null>(initialSpace);
  const [peers, setPeers] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing local airspace");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [progress, setProgress] = useState<{ name: string; value: number } | null>(null);
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [caughtFile, setCaughtFile] = useState<SavedFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const channels = useRef(new Map<string, RTCDataChannel>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const outgoing = useRef(new Map<string, { peer: string; file: File }>());
  const incoming = useRef(new Map<string, Incoming>());
  const fileUrls = useRef(new Set<string>());
  const handleDataRef = useRef<(peer: string, event: MessageEvent) => void>(() => undefined);
  const input = useRef<HTMLInputElement | null>(null);

  const chosen = useMemo(
    () => peers.find((peer) => peer.id === selected) || null,
    [peers, selected],
  );
  const thread = chat.filter((message) => message.peer === selected);
  const received = files.filter((file) => file.peer === selected);
  const selectedIndex = Math.max(0, peers.findIndex((peer) => peer.id === selected));

  const toast = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(
      () => setNotice((current) => (current === message ? null : current)),
      2800,
    );
  }, []);

  const signal = useCallback(
    async (to: string, payload: Signal) => {
      if (!self) return;
      const response = await fetch("/api/signal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: self.id, to, signal: payload, space }),
      });
      if (!response.ok) throw new Error("Signaling unavailable");
    },
    [self, space],
  );

  const closePeer = useCallback((id: string) => {
    channels.current.get(id)?.close();
    pcs.current.get(id)?.close();
    channels.current.delete(id);
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    const activeIncoming = incoming.current.get(id);
    if (activeIncoming) {
      incoming.current.delete(id);
      setProgress(null);
    }
  }, []);

  const sendWire = useCallback((peer: string, data: Wire) => {
    const channel = channels.current.get(peer);
    if (!channel || channel.readyState !== "open") throw new Error("not connected");
    channel.send(JSON.stringify(data));
  }, []);

  const bind = useCallback(
    (peer: string, channel: RTCDataChannel) => {
      channel.binaryType = "arraybuffer";
      channels.current.set(peer, channel);
      channel.onmessage = (event) => handleDataRef.current(peer, event);
      channel.onopen = () => setStatus("Direct encrypted route ready");
      channel.onclose = () => channels.current.delete(peer);
      channel.onerror = () => setStatus("Direct route interrupted");
    },
    [],
  );

  const connect = useCallback(
    (peer: string, initiator: boolean) => {
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
        void pc
          .createOffer()
          .then(async (description) => {
            await pc.setLocalDescription(description);
            await signal(peer, { description: pc.localDescription! });
          })
          .catch(() => closePeer(peer));
      }
      return pc;
    },
    [bind, closePeer, signal],
  );

  const receiveSignal = useCallback(
    async (from: string, payload: Signal) => {
      const pc = connect(from, false);
      if (payload.description) {
        await pc.setRemoteDescription(payload.description);
        for (const candidate of pendingIce.current.get(from) || []) {
          await pc.addIceCandidate(candidate);
        }
        pendingIce.current.delete(from);
        if (payload.description.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signal(from, { description: pc.localDescription! });
        }
      }
      if (payload.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
        else {
          pendingIce.current.set(from, [
            ...(pendingIce.current.get(from) || []),
            payload.candidate,
          ]);
        }
      }
    },
    [connect, signal],
  );

  const waitChannel = useCallback(
    async (peer: string) => {
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
    },
    [connect],
  );

  const sendFileBytes = useCallback(
    async (peer: string, id: string, file: File) => {
      const channel = await waitChannel(peer);
      setProgress({ name: file.name, value: 0 });
      for (let offset = 0; offset < file.size; offset += CHUNK) {
        while (channel.bufferedAmount > 4 * 1024 * 1024) {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        channel.send(await file.slice(offset, offset + CHUNK).arrayBuffer());
        setProgress({
          name: file.name,
          value: Math.round((Math.min(file.size, offset + CHUNK) / Math.max(1, file.size)) * 100),
        });
      }
      sendWire(peer, { type: "end", id });
      window.setTimeout(() => setProgress(null), 900);
    },
    [sendWire, waitChannel],
  );

  const handleData = useCallback(
    (peer: string, event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const transfer = incoming.current.get(peer);
        if (!transfer) return;
        transfer.chunks.push(event.data);
        transfer.received += event.data.byteLength;
        setProgress({
          name: transfer.name,
          value: Math.min(
            99,
            Math.round((transfer.received / Math.max(1, transfer.size)) * 100),
          ),
        });
        return;
      }

      let message: Wire;
      try {
        message = JSON.parse(String(event.data)) as Wire;
      } catch {
        return;
      }

      if (message.type === "text") {
        setChat((items) => [
          ...items,
          { id: message.id, peer, mine: false, text: message.text.slice(0, 20_000) },
        ]);
      }

      if (message.type === "file") {
        if (message.size < 0 || message.size > LIMIT || incoming.current.has(peer)) {
          try {
            sendWire(peer, { type: "accept", id: message.id, accepted: false });
          } catch {
            // The peer may already be gone.
          }
          toast(message.size > LIMIT ? "Incoming file exceeds 512 MB." : "Another file is already arriving.");
          return;
        }
        setOffer({
          peer,
          id: message.id,
          name: message.name.slice(0, 180) || "Unnamed file",
          size: message.size,
          mime: message.mime.slice(0, 120) || "application/octet-stream",
        });
      }

      if (message.type === "accept") {
        const item = outgoing.current.get(message.id);
        if (!item) return;
        outgoing.current.delete(message.id);
        if (message.accepted) void sendFileBytes(item.peer, message.id, item.file);
        else toast("The file was declined.");
      }

      if (message.type === "end") {
        const item = incoming.current.get(peer);
        if (!item || item.id !== message.id) return;
        incoming.current.delete(peer);
        setProgress(null);

        if (item.received !== item.size) {
          toast(`Transfer incomplete: received ${bytes(item.received)} of ${bytes(item.size)}.`);
          return;
        }

        const url = URL.createObjectURL(new Blob(item.chunks, { type: item.mime }));
        fileUrls.current.add(url);
        const saved = { id: item.id, peer, name: item.name, size: item.size, url };
        setFiles((list) => [...list, saved]);
        setCaughtFile(saved);
        toast(`${item.name} was caught.`);
      }
    },
    [sendFileBytes, sendWire, toast],
  );

  useEffect(() => {
    handleDataRef.current = handleData;
  }, [handleData]);

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
          body: JSON.stringify({ peer: self, space }),
          cache: "no-store",
        });
        const result = (await response.json()) as { peers?: Device[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Discovery unavailable");
        const next = result.peers || [];
        if (!stopped) {
          setPeers(next);
          setSelected((current) =>
            current && next.some((peer) => peer.id === current)
              ? current
              : next[0]?.id || null,
          );
          setStatus(
            next.length
              ? `${next.length} nearby device${next.length === 1 ? "" : "s"} found`
              : space
                ? "Hotspot link active — waiting for another device"
                : "Waiting for another device",
          );
        }
      } catch (error) {
        if (!stopped) {
          setStatus(error instanceof Error ? error.message : "Discovery unavailable");
        }
      }
    };

    const pollSignals = async () => {
      try {
        const query = new URLSearchParams({ peer: self.id });
        if (space) query.set("space", space);
        const response = await fetch(`/api/signal?${query.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as {
          signals?: Array<{ from: string; signal: Signal }>;
        };
        for (const item of result.signals || []) {
          await receiveSignal(item.from, item.signal);
        }
      } catch {
        // The presence status communicates backend configuration failures.
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
  }, [receiveSignal, self, space]);

  async function shareHotspotLink() {
    let activeSpace = space;
    if (!activeSpace) {
      activeSpace = `hotspot-${uid().slice(0, 24)}`;
      const url = new URL(window.location.href);
      url.searchParams.set("space", activeSpace);
      window.history.replaceState(null, "", url);
      setSpace(activeSpace);
      setPeers([]);
      setSelected(null);
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      channels.current.clear();
    }

    const link = new URL(window.location.href);
    link.searchParams.set("space", activeSpace);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Throwit",
          text: `Join ${self?.name || "my device"} on Throwit`,
          url: link.toString(),
        });
      } else {
        await navigator.clipboard.writeText(link.toString());
        toast("Hotspot link copied. Open it on your phone.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await navigator.clipboard.writeText(link.toString());
      toast("Hotspot link copied. Open it on your phone.");
    }
  }

  async function sendText(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!chosen || !value) return;
    try {
      await waitChannel(chosen.id);
      const id = uid();
      sendWire(chosen.id, { type: "text", id, text: value.slice(0, 20_000) });
      setChat((items) => [
        ...items,
        { id, peer: chosen.id, mine: true, text: value.slice(0, 20_000) },
      ]);
      setText("");
      animateThrow();
    } catch {
      toast("Could not reach that device.");
    }
  }

  function prepareFile(file?: File) {
    if (!file) return;
    if (file.size > LIMIT) {
      toast("Files are limited to 512 MB.");
      return;
    }
    setLoadedFile(file);
    setMode("file");
  }

  async function throwFile() {
    if (!loadedFile || !chosen) return;
    try {
      await waitChannel(chosen.id);
      const id = uid();
      outgoing.current.set(id, { peer: chosen.id, file: loadedFile });
      sendWire(chosen.id, {
        type: "file",
        id,
        name: loadedFile.name,
        size: loadedFile.size,
        mime: loadedFile.type || "application/octet-stream",
      });
      animateThrow();
      toast(`Waiting for ${chosen.name} to catch it.`);
    } catch {
      toast("Could not prepare the direct route.");
    }
  }

  function animateThrow() {
    setFlying(false);
    requestAnimationFrame(() => setFlying(true));
    window.setTimeout(() => setFlying(false), 1450);
  }

  function answer(accepted: boolean) {
    if (!offer) return;
    if (accepted) {
      incoming.current.set(offer.peer, { ...offer, chunks: [], received: 0 });
      setProgress({ name: offer.name, value: 0 });
    }
    try {
      sendWire(offer.peer, { type: "accept", id: offer.id, accepted });
    } catch {
      toast("The sender disconnected.");
    }
    setOffer(null);
  }

  return (
    <main className="app">
      <header className="nav">
        <div className="brand">
          <Image
            src="/paper-logo.webp"
            width={44}
            height={44}
            alt="Throwit paper mascot"
            priority
          />
          <span>throwit</span>
        </div>
        <div className="nav-actions">
          <span className="identity-chip">{self?.name || "Generating identity"}</span>
          <div className="secure">
            <i />
            <span>{status}</span>
          </div>
          <button className={space ? "pair active" : "pair"} onClick={() => void shareHotspotLink()}>
            {space ? "Share hotspot link" : "Pair hotspot"}
          </button>
        </div>
      </header>

      <section className="canvas">
        <div className="intro">
          <small>LOCAL AIRSPACE</small>
          <h1>
            Don&apos;t upload it.
            <br />
            <em>Throw it.</em>
          </h1>
          <p>Choose a nearby browser and throw files or temporary text directly to it.</p>
        </div>

        <section className={`radar selected-${selectedIndex + 1} ${flying ? "throwing" : ""}`}>
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          {chosen && <div className="beam" />}
          <div className={`paper-core ${flying ? "launch" : ""}`}>
            <Image src="/paper-logo.webp" width={190} height={190} alt="" priority />
          </div>
          <div className={`flight-copy target-${selectedIndex + 1} ${flying ? "go" : ""}`}>
            <span className="flight-sparks" />
            <Image src="/paper-logo.webp" width={92} height={92} alt="" />
          </div>
          <div className="core-copy">
            <strong>{peers.length ? "Ready to throw" : "Ready to catch your payload"}</strong>
            <span>
              {peers.length
                ? `aimed at ${chosen?.name || "a nearby device"}`
                : space
                  ? "open the shared hotspot link on another device"
                  : "open Throwit on another device"}
            </span>
          </div>
          <div className="peers">
            {peers.slice(0, 6).map((peer, index) => (
              <button
                key={peer.id}
                className={`peer p${index + 1} ${selected === peer.id ? "active" : ""}`}
                onClick={() => {
                  setSelected(peer.id);
                  connect(peer.id, true);
                }}
              >
                <span className="device-icon">
                  {peer.kind === "mobile" ? "▯" : peer.kind === "tablet" ? "▰" : "▭"}
                </span>
                <span className="peer-copy">
                  <strong>{peer.name}</strong>
                  <small>{selected === peer.id ? "selected" : `${peer.kind} · available`}</small>
                </span>
              </button>
            ))}
          </div>
          {!peers.length && (
            <div className="searching">
              <i />
              <span>{status}</span>
            </div>
          )}
        </section>

        <section className={`dock ${mode === "text" ? "text-open" : ""}`}>
          <div className="tabs">
            <button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}>
              File
            </button>
            <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>
              Text
            </button>
          </div>
          {mode === "file" ? (
            <>
              <button className="payload" onClick={() => input.current?.click()} disabled={!chosen}>
                <span>{loadedFile ? "↑" : "+"}</span>
                <div>
                  <strong>{loadedFile?.name || "Choose a file"}</strong>
                  <small>
                    {loadedFile
                      ? bytes(loadedFile.size)
                      : chosen
                        ? `to ${chosen.name}`
                        : "select a device first"}
                  </small>
                </div>
              </button>
              <input
                ref={input}
                hidden
                type="file"
                onChange={(event) => {
                  prepareFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button className="throw" disabled={!chosen || !loadedFile} onClick={() => void throwFile()}>
                <span>→</span>
                <strong>throw it</strong>
              </button>
            </>
          ) : (
            <div className="text-dock">
              <div className="thread">
                {!thread.length && !received.length && (
                  <p>Temporary chat with {chosen?.name || "a selected device"}.</p>
                )}
                {thread.map((item) => (
                  <article key={item.id} className={item.mine ? "mine" : ""}>
                    {item.text}
                    <button onClick={() => void navigator.clipboard.writeText(item.text)}>copy</button>
                  </article>
                ))}
                {received.map((file) => (
                  <article key={file.id} className="received">
                    <span>↓</span>
                    <div>
                      <strong>{file.name}</strong>
                      <small>{bytes(file.size)}</small>
                    </div>
                    <a href={file.url} download={file.name}>
                      save
                    </a>
                  </article>
                ))}
              </div>
              <form onSubmit={sendText}>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={!chosen}
                  placeholder={chosen ? "Write or paste something…" : "Choose a device first"}
                />
                <button disabled={!chosen || !text.trim()}>→</button>
              </form>
            </div>
          )}
        </section>
      </section>

      <footer>
        <span>Encrypted by WebRTC</span>
        <span>Files never touch the server</span>
      </footer>

      {progress && (
        <div className="progress">
          <div>
            <strong>{progress.name}</strong>
            <span>{progress.value}%</span>
          </div>
          <i>
            <b style={{ width: `${progress.value}%` }} />
          </i>
        </div>
      )}

      {offer && (
        <div className="modal">
          <section>
            <Image src="/paper-logo.webp" width={94} height={94} alt="" />
            <small>INCOMING THROW</small>
            <h2>Catch {offer.name}?</h2>
            <p>{bytes(offer.size)}</p>
            <div>
              <button onClick={() => answer(false)}>Decline</button>
              <button className="accept" onClick={() => answer(true)}>
                Catch it
              </button>
            </div>
          </section>
        </div>
      )}

      {caughtFile && (
        <div className="modal caught-modal">
          <section>
            <Image src="/paper-logo.webp" width={94} height={94} alt="" />
            <small>CAUGHT SUCCESSFULLY</small>
            <h2>{caughtFile.name}</h2>
            <p>{bytes(caughtFile.size)} is ready to save.</p>
            <div>
              <button onClick={() => setCaughtFile(null)}>Close</button>
              <a className="accept" href={caughtFile.url} download={caughtFile.name} onClick={() => setCaughtFile(null)}>
                Save file
              </a>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}
