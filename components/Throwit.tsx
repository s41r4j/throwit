"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Device = { id: string; name: string; kind: "desktop" | "mobile" | "tablet" | "unknown" };
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type ServerMessage =
  | { type: "peers"; peers: Device[] }
  | { type: "signal"; from: string; signal: Signal }
  | { type: "ready" }
  | { type: "pong" };
type Wire =
  | { type: "text"; id: string; text: string }
  | { type: "file"; id: string; name: string; size: number; mime: string }
  | { type: "accept"; id: string; accepted: boolean }
  | { type: "end"; id: string };
type Chat = { id: string; peer: string; mine: boolean; text: string };
type Offer = { peer: string; id: string; name: string; size: number; mime: string };
type Incoming = Offer & { chunks: ArrayBuffer[]; received: number };

const CHUNK = 64 * 1024;
const LIMIT = 512 * 1024 * 1024;
const uid = () => crypto.randomUUID().replaceAll("-", "");
const bytes = (n: number) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

function identity(): Device {
  const ua = navigator.userAgent;
  const kind = /iPad|Tablet/i.test(ua) ? "tablet" : /iPhone|Android|Mobile/i.test(ua) ? "mobile" : "desktop";
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Chrome/") ? "Chrome" : ua.includes("Safari/") ? "Safari" : "Browser";
  const platform = /iPhone|iPad/i.test(ua) ? "iPhone" : /Android/i.test(ua) ? "Android" : /Macintosh/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "Device";
  return { id: uid(), name: `${browser} on ${platform}`, kind };
}

export default function Throwit() {
  const [self, setSelf] = useState<Device | null>(null);
  const [peers, setPeers] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("Connecting");
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Chat[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [progress, setProgress] = useState<{ name: string; value: number } | null>(null);
  const [files, setFiles] = useState<Array<{ id: string; peer: string; name: string; url: string; size: number }>>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const socket = useRef<WebSocket | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const channels = useRef(new Map<string, RTCDataChannel>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const outgoing = useRef(new Map<string, { peer: string; file: File }>());
  const incoming = useRef(new Map<string, Incoming>());
  const input = useRef<HTMLInputElement | null>(null);

  const chosen = useMemo(() => peers.find((p) => p.id === selected) || null, [peers, selected]);
  const thread = chat.filter((m) => m.peer === selected);
  const received = files.filter((f) => f.peer === selected);

  const toast = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((value) => value === message ? null : value), 2600);
  }, []);

  const signal = useCallback((to: string, payload: Signal) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "signal", to, signal: payload }));
  }, []);

  const closePeer = useCallback((id: string) => {
    channels.current.get(id)?.close();
    pcs.current.get(id)?.close();
    channels.current.delete(id);
    pcs.current.delete(id);
    pendingIce.current.delete(id);
  }, []);

  const sendWire = useCallback((peer: string, data: Wire) => {
    const channel = channels.current.get(peer);
    if (!channel || channel.readyState !== "open") throw new Error("not connected");
    channel.send(JSON.stringify(data));
  }, []);

  const waitChannel = useCallback(async (peer: string) => {
    const current = channels.current.get(peer);
    if (current?.readyState === "open") return current;
    connect(peer, true);
    return new Promise<RTCDataChannel>((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const channel = channels.current.get(peer);
        if (channel?.readyState === "open") { clearInterval(timer); resolve(channel); }
        else if (Date.now() - started > 12000) { clearInterval(timer); reject(new Error("timeout")); }
      }, 120);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendFileBytes = useCallback(async (peer: string, id: string, file: File) => {
    const channel = await waitChannel(peer);
    setProgress({ name: file.name, value: 0 });
    for (let offset = 0; offset < file.size; offset += CHUNK) {
      while (channel.bufferedAmount > 4 * 1024 * 1024) await new Promise((r) => setTimeout(r, 25));
      channel.send(await file.slice(offset, offset + CHUNK).arrayBuffer());
      setProgress({ name: file.name, value: Math.round(Math.min(file.size, offset + CHUNK) / file.size * 100) });
    }
    sendWire(peer, { type: "end", id });
    window.setTimeout(() => setProgress(null), 800);
  }, [sendWire, waitChannel]);

  const handleData = useCallback((peer: string, event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      const transfer = incoming.current.get(peer);
      if (!transfer) return;
      transfer.chunks.push(event.data);
      transfer.received += event.data.byteLength;
      setProgress({ name: transfer.name, value: Math.min(99, Math.round(transfer.received / transfer.size * 100)) });
      return;
    }
    let message: Wire;
    try { message = JSON.parse(String(event.data)) as Wire; } catch { return; }
    if (message.type === "text") setChat((items) => [...items, { id: message.id, peer, mine: false, text: message.text }]);
    if (message.type === "file") setOffer({ peer, id: message.id, name: message.name, size: message.size, mime: message.mime });
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
      const url = URL.createObjectURL(new Blob(item.chunks, { type: item.mime }));
      setFiles((list) => [...list, { id: item.id, peer, name: item.name, size: item.size, url }]);
      incoming.current.delete(peer);
      setProgress(null);
      toast(`${item.name} was caught.`);
    }
  }, [sendFileBytes, toast]);

  const bind = useCallback((peer: string, channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channels.current.set(peer, channel);
    channel.onmessage = (event) => handleData(peer, event);
    channel.onopen = () => setStatus("Direct connection ready");
    channel.onclose = () => channels.current.delete(peer);
  }, [handleData]);

  const connect = useCallback((peer: string, initiator: boolean) => {
    if (pcs.current.has(peer)) return pcs.current.get(peer)!;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }] });
    pcs.current.set(peer, pc);
    pc.onicecandidate = ({ candidate }) => candidate && signal(peer, { candidate: candidate.toJSON() });
    pc.ondatachannel = ({ channel }) => bind(peer, channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("Direct connection ready");
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(peer);
    };
    if (initiator) {
      bind(peer, pc.createDataChannel("throwit", { ordered: true }));
      void pc.createOffer().then(async (description) => { await pc.setLocalDescription(description); signal(peer, { description: pc.localDescription! }); });
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
        signal(from, { description: pc.localDescription! });
      }
    }
    if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
      else pendingIce.current.set(from, [...(pendingIce.current.get(from) || []), payload.candidate]);
    }
  }, [connect, signal]);

  useEffect(() => {
    const me = identity();
    setSelf(me);
    let stopped = false;
    let retry = 500;
    let ping: number | undefined;
    const open = () => {
      if (stopped) return;
      setStatus("Connecting");
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(process.env.NEXT_PUBLIC_SIGNALING_URL || `${protocol}//${location.host}/api/ws`);
      socket.current = ws;
      ws.onopen = () => {
        retry = 500;
        setStatus("Looking for nearby devices");
        ws.send(JSON.stringify({ type: "hello", peer: me }));
        ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 20000);
      };
      ws.onmessage = (event) => {
        let message: ServerMessage;
        try { message = JSON.parse(event.data) as ServerMessage; } catch { return; }
        if (message.type === "peers") {
          setPeers(message.peers);
          setStatus(message.peers.length ? "Nearby devices found" : "Waiting for another device");
          setSelected((current) => current && message.peers.some((p) => p.id === current) ? current : message.peers[0]?.id || null);
        }
        if (message.type === "signal") void receiveSignal(message.from, message.signal);
      };
      ws.onclose = () => {
        if (ping) clearInterval(ping);
        if (!stopped) { setStatus("Reconnecting"); window.setTimeout(open, retry); retry = Math.min(retry * 2, 8000); }
      };
    };
    open();
    return () => {
      stopped = true;
      if (ping) clearInterval(ping);
      socket.current?.close();
      pcs.current.forEach((pc) => pc.close());
      files.forEach((file) => URL.revokeObjectURL(file.url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiveSignal]);

  async function sendText(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!chosen || !value) return;
    try {
      await waitChannel(chosen.id);
      const id = uid();
      sendWire(chosen.id, { type: "text", id, text: value.slice(0, 20000) });
      setChat((items) => [...items, { id, peer: chosen.id, mine: true, text: value }]);
      setText("");
    } catch { toast("Could not reach that device."); }
  }

  async function chooseFile(file?: File) {
    if (!file || !chosen) return;
    if (file.size > LIMIT) return toast("Files are limited to 512 MB.");
    try {
      await waitChannel(chosen.id);
      const id = uid();
      outgoing.current.set(id, { peer: chosen.id, file });
      sendWire(chosen.id, { type: "file", id, name: file.name, size: file.size, mime: file.type || "application/octet-stream" });
      toast(`Waiting for ${chosen.name} to catch it.`);
    } catch { toast("Could not prepare the direct route."); }
  }

  function answer(accepted: boolean) {
    if (!offer) return;
    if (accepted) incoming.current.set(offer.peer, { ...offer, chunks: [], received: 0 });
    try { sendWire(offer.peer, { type: "accept", id: offer.id, accepted }); } catch { toast("The sender disconnected."); }
    setOffer(null);
  }

  return <main className="app">
    <header className="nav">
      <div className="brand"><Image src="/paper-logo.webp" width={46} height={46} alt="Throwit paper mascot" priority /><span>throwit</span></div>
      <div className="state"><i /><span>{status}</span></div>
    </header>

    <section className="layout">
      <div className="intro"><small>LOCAL PEER-TO-PEER TRANSFER</small><h1>Don&apos;t upload it.<br /><em>Throw it.</em></h1><p>Fast file sharing and temporary text chat, directly between nearby browsers.</p></div>

      <section className="airspace">
        <div className="orbit one" /><div className="orbit two" />
        <div className="center"><Image src="/paper-logo.webp" width={210} height={210} alt="" priority /><strong>{self?.name || "This device"}</strong><span>{peers.length ? "Choose where to throw" : "Open Throwit on another device"}</span></div>
        <div className="peers">{peers.slice(0, 6).map((peer, index) => <button key={peer.id} className={`peer p${index + 1} ${selected === peer.id ? "active" : ""}`} onClick={() => { setSelected(peer.id); connect(peer.id, true); }}><span>{peer.kind === "mobile" ? "▯" : "▭"}</span><div><strong>{peer.name}</strong><small>available</small></div></button>)}</div>
        {!peers.length && <div className="searching"><i /><strong>Looking for devices</strong><p>Use the same Wi-Fi or network.</p></div>}
      </section>

      <aside className="panel">
        <div className="panel-title"><small>THROWING TO</small><h2>{chosen?.name || "No device selected"}</h2></div>
        <button className="drop" disabled={!chosen} onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void chooseFile(e.dataTransfer.files[0]); }}><span>↑</span><div><strong>Throw a file</strong><small>Choose or drop it here</small></div></button>
        <input ref={input} hidden type="file" onChange={(e) => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="thread">{!chosen && <p className="empty">Select a device to begin.</p>}{chosen && !thread.length && !received.length && <p className="empty">Send text like a private temporary chat.</p>}{thread.map((item) => <article key={item.id} className={item.mine ? "bubble mine" : "bubble"}><p>{item.text}</p><button onClick={() => navigator.clipboard.writeText(item.text)}>Copy</button></article>)}{received.map((file) => <article className="file" key={file.id}><span>↓</span><div><strong>{file.name}</strong><small>{bytes(file.size)}</small></div><a href={file.url} download={file.name}>Save</a></article>)}</div>
        <form className="compose" onSubmit={sendText}><textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!chosen} placeholder={chosen ? "Write or paste something…" : "Choose a device first"} /><button disabled={!chosen || !text.trim()}>➤</button></form>
      </aside>
    </section>

    <footer><span>Encrypted by WebRTC</span><span>Files never touch the server</span></footer>
    {progress && <div className="progress"><div><strong>{progress.name}</strong><span>{progress.value}%</span></div><i><b style={{ width: `${progress.value}%` }} /></i></div>}
    {offer && <div className="modal"><section><Image src="/paper-logo.webp" width={92} height={92} alt="" /><small>INCOMING THROW</small><h2>Catch {offer.name}?</h2><p>{bytes(offer.size)}</p><div><button onClick={() => answer(false)}>Decline</button><button className="accept" onClick={() => answer(true)}>Catch it</button></div></section></div>}
    {notice && <div className="toast">{notice}</div>}
  </main>;
}
