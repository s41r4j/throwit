"use client";

import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

type Peer = { id: string; name: string; kind: string };
type Wire =
  | { type: "text"; text: string; from: string }
  | { type: "file-meta"; name: string; size: number; mime: string; from: string }
  | { type: "file-end" };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "missing-key"
);

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  return "Browser";
}

export default function Home() {
  const id = useMemo(() => crypto.randomUUID(), []);
  const [name] = useState(() => typeof window === "undefined" ? "Device" : deviceName());
  const [space, setSpace] = useState("");
  const [spaceInput, setSpaceInput] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState("Joining local airspace…");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [flying, setFlying] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const incomingRef = useRef<{ name: string; size: number; mime: string } | null>(null);

  async function signal(event: string, payload: unknown) {
    await channelRef.current?.send({ type: "broadcast", event, payload });
  }

  function bindDataChannel(dc: RTCDataChannel) {
    dcRef.current = dc;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => setStatus("Direct encrypted connection ready");
    dc.onclose = () => setStatus("Connection closed");
    dc.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data) as Wire;
        if (msg.type === "text") setMessages((m) => [`${msg.from}: ${msg.text}`, ...m].slice(0, 30));
        if (msg.type === "file-meta") {
          incomingRef.current = { name: msg.name, size: msg.size, mime: msg.mime };
          chunksRef.current = [];
          setProgress(0);
          setStatus(`Receiving ${msg.name}`);
        }
        if (msg.type === "file-end" && incomingRef.current) {
          const meta = incomingRef.current;
          const blob = new Blob(chunksRef.current, { type: meta.mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = meta.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          setStatus(`${meta.name} received`);
          setProgress(100);
          incomingRef.current = null;
        }
      } else if (event.data instanceof ArrayBuffer && incomingRef.current) {
        chunksRef.current.push(event.data);
        const got = chunksRef.current.reduce((n, b) => n + b.byteLength, 0);
        setProgress(Math.min(99, Math.round((got / incomingRef.current.size) * 100)));
      }
    };
  }

  async function createPeer(remoteId: string, initiator: boolean) {
    pcRef.current?.close();
    const ice = await fetch("/api/ice", { cache: "no-store" }).then((r) => r.json());
    const pc = new RTCPeerConnection({ iceServers: ice.iceServers });
    pcRef.current = pc;
    pc.onicecandidate = (e) => e.candidate && signal("ice", { to: remoteId, from: id, candidate: e.candidate });
    pc.onconnectionstatechange = () => setStatus(`Connection: ${pc.connectionState}`);
    pc.ondatachannel = (e) => bindDataChannel(e.channel);
    if (initiator) {
      const dc = pc.createDataChannel("throwit", { ordered: true });
      bindDataChannel(dc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await signal("offer", { to: remoteId, from: id, sdp: offer });
    }
  }

  async function connect(peerId: string) {
    setSelected(peerId);
    setStatus("Building direct route…");
    await createPeer(peerId, true);
  }

  async function sendText() {
    if (!text.trim() || dcRef.current?.readyState !== "open") return;
    dcRef.current.send(JSON.stringify({ type: "text", text: text.trim(), from: name } satisfies Wire));
    setMessages((m) => [`You: ${text.trim()}`, ...m].slice(0, 30));
    setText("");
    setFlying(true);
    setTimeout(() => setFlying(false), 900);
  }

  async function sendFile() {
    const dc = dcRef.current;
    if (!file || !dc || dc.readyState !== "open") return;
    if (file.size > 512 * 1024 * 1024) return setStatus("File exceeds 512 MB safety limit");
    setFlying(true);
    setProgress(0);
    dc.send(JSON.stringify({ type: "file-meta", name: file.name, size: file.size, mime: file.type || "application/octet-stream", from: name } satisfies Wire));
    const chunk = 64 * 1024;
    for (let offset = 0; offset < file.size; offset += chunk) {
      while (dc.bufferedAmount > 4 * 1024 * 1024) await new Promise((r) => setTimeout(r, 20));
      dc.send(await file.slice(offset, offset + chunk).arrayBuffer());
      setProgress(Math.round((Math.min(file.size, offset + chunk) / file.size) * 100));
    }
    dc.send(JSON.stringify({ type: "file-end" } satisfies Wire));
    setStatus(`${file.name} thrown successfully`);
    setTimeout(() => setFlying(false), 900);
  }

  useEffect(() => {
    let active = true;
    async function join() {
      const net = await fetch("/api/network", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ space: space || undefined })
      }).then((r) => r.json());
      if (!active) return;
      const channel = supabase.channel(`throwit:${net.id}`, { config: { presence: { key: id } } });
      channelRef.current = channel;
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState() as Record<string, Array<{ id: string; name: string; kind: string }>>;
          const list = Object.values(state).flat().filter((p) => p.id !== id);
          setPeers(list);
          if (!selected && list[0]) setSelected(list[0].id);
          setStatus(list.length ? "Nearby devices found" : "Waiting for another device…");
        })
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.to !== id) return;
          setSelected(payload.from);
          await createPeer(payload.from, false);
          await pcRef.current!.setRemoteDescription(payload.sdp);
          const answer = await pcRef.current!.createAnswer();
          await pcRef.current!.setLocalDescription(answer);
          await signal("answer", { to: payload.from, from: id, sdp: answer });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.to === id) await pcRef.current?.setRemoteDescription(payload.sdp);
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (payload.to === id && pcRef.current) await pcRef.current.addIceCandidate(payload.candidate);
        })
        .subscribe(async (s) => {
          if (s === "SUBSCRIBED") await channel.track({ id, name, kind: name.toLowerCase() });
        });
    }
    join().catch(() => setStatus("Unable to join signaling service"));
    return () => {
      active = false;
      channelRef.current && supabase.removeChannel(channelRef.current);
      pcRef.current?.close();
    };
  }, [space]);

  const chosen = peers.find((p) => p.id === selected);

  return <main className="shell">
    <header>
      <img src="/paper-logo.webp" alt="Throwit" className="logo" />
      <button className="space" onClick={() => {
        const code = prompt("Private space code", spaceInput || "");
        if (code !== null) { setSpaceInput(code); setSpace(code.trim().toUpperCase()); }
      }}>{space ? `Private: ${space}` : "Local airspace"}</button>
    </header>

    <section className="hero">
      <div className="copy">
        <p className="eyebrow">Direct browser-to-browser transfer</p>
        <h1>Don’t upload it.<br /><span>Throw it.</span></h1>
        <p>Files and text move directly between devices through an encrypted WebRTC connection.</p>
        <div className="status"><i />{status}</div>
      </div>

      <div className="airspace">
        <div className="ring r1" /><div className="ring r2" /><div className="ring r3" />
        <img src="/paper-logo.webp" alt="" className={`paper ${flying ? "fly" : ""}`} />
        <div className="devices">
          {peers.length === 0 ? <div className="empty">Open Throwit on another device connected to the same network.</div> : peers.map((peer) =>
            <button key={peer.id} className={selected === peer.id ? "device active" : "device"} onClick={() => connect(peer.id)}>
              <span>{peer.name.slice(0, 1)}</span><strong>{peer.name}</strong><small>{selected === peer.id ? "selected" : "tap to connect"}</small>
            </button>
          )}
        </div>
      </div>

      <aside>
        <h2>Transfer</h2>
        <p>Target: <strong>{chosen?.name || "No device selected"}</strong></p>
        <label className="filebox">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <span>{file ? file.name : "Choose a file"}</span>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Up to 512 MB"}</small>
        </label>
        <button className="primary" disabled={!file || !chosen} onClick={sendFile}>Throw file</button>
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text, a link, or a note…" />
        <button className="primary" disabled={!text.trim() || !chosen} onClick={sendText}>Send text</button>
        <div className="messages">{messages.map((m, i) => <p key={i}>{m}</p>)}</div>
      </aside>
    </section>
  </main>;
}
