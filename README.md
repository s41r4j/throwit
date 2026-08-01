# Throwit

A production-oriented Next.js WebRTC application for direct file and text transfer between browsers. The UI is hosted on Vercel; payloads move peer-to-peer over encrypted WebRTC data channels and never pass through the Vercel or Supabase servers.

## Architecture

```text
Device A ── presence/signaling ── Supabase Realtime ── presence/signaling ── Device B
    └──────────────── encrypted WebRTC DataChannel ────────────────────────┘

Vercel Route Handlers:
- /api/network: produces an opaque, rotating network-space token
- /api/ice: provides STUN and optional short-lived TURN credentials
```

### Automatic matching

A normal web page cannot scan a LAN or enumerate devices. Throwit uses the best browser-compatible approximation: `/api/network` groups requests by their public IPv4 address or IPv6 `/64` prefix and converts that value into a rotating HMAC token. The raw IP address is never sent to the browser or Supabase.

This works well for typical home/office NAT networks. It is not proof that devices are physically nearby: carrier-grade NAT, corporate proxies, VPNs, IPv4/IPv6 differences, or privacy relays can create false matches or prevent a match. The **Private space** control is the deterministic fallback.

## Features

- Automatic same-network presence
- Optional private connection code
- Direct WebRTC file transfer with backpressure
- 64 KiB chunking and progress updates
- Text threads with copy action
- Explicit acceptance before receiving a file
- 512 MB browser-memory safety limit
- Encrypted DTLS data channels
- Rotating opaque network identifiers
- Optional expiring TURN REST credentials
- Responsive, accessible interface
- TypeScript, ESLint, Vitest, and GitHub Actions CI

## Local setup

1. Create a Supabase project.
2. Copy the Project URL and publishable key from the project Connect dialog or API settings.
3. Copy the environment template:

```bash
cp .env.example .env.local
```

4. Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
NETWORK_TOKEN_SECRET=YOUR_LONG_RANDOM_SECRET
```

Generate the network secret with:

```bash
openssl rand -base64 48
```

5. Install and run:

```bash
npm install
npm run dev
```

Open the local URL on two devices. For testing across physical devices, use an HTTPS tunnel or deploy to Vercel because WebRTC and Clipboard APIs require a secure context outside `localhost`.

## Supabase configuration

Throwit uses public Realtime Broadcast and Presence channels with unpredictable HMAC channel names. It does not create database tables and does not store chat messages, files, SDP records, or presence history.

In Supabase, ensure Realtime is enabled. No SQL migration is required.

For a higher-security deployment, replace public Realtime channels with authenticated private channels and issue short-lived Supabase JWTs from a server route.

## Vercel deployment

1. Push this directory to GitHub.
2. Import the repository into Vercel.
3. Add the variables from `.env.example` in **Project Settings → Environment Variables**.
4. Deploy.

The frontend and short Route Handlers are Vercel-native. Supabase provides the persistent realtime signaling connection, avoiding dependence on long-lived state inside a Vercel Function.

## TURN for real-world reliability

Same-LAN WebRTC often connects with STUN alone. Restricted corporate networks, symmetric NAT, guest Wi-Fi isolation, and some mobile paths require TURN.

The included `/api/ice` route supports the coturn TURN REST API:

```env
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:5349?transport=tcp
TURN_SHARED_SECRET=the-same-static-auth-secret-used-by-coturn
TURN_TTL_SECONDS=3600
```

Configure coturn with `use-auth-secret` and the matching `static-auth-secret`. The browser receives expiring credentials rather than a permanent password embedded in the JavaScript bundle.

## Production checklist

- Configure TURN in at least two regions.
- Enable Vercel WAF/rate limits for `/api/network` and `/api/ice`.
- Use a paid Supabase plan sized for peak concurrent presence.
- Set spending alerts on Vercel, Supabase, and TURN infrastructure.
- Add Sentry or another error collector with payload redaction.
- Test Chrome, Safari, Firefox, iOS, and Android on isolated guest Wi-Fi.
- Add authenticated private channels before handling highly sensitive enterprise data.
- Keep the file size limit conservative unless the receive path is changed to stream directly to disk.

## Important browser limits

- Browsers cannot reliably discover arbitrary LAN devices without a signaling rendezvous.
- Automatic clipboard writes may require a user gesture and browser permission.
- Received files are assembled in browser memory; the current build limits files to 512 MB.
- Closing or background-suspending a mobile tab interrupts active transfers.
- WebRTC encrypts transport, but a user must still trust the selected peer and signaling deployment.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```
