# Throwit

A Snapdrop-style web app for throwing files and text directly between nearby browsers.

- **Frontend:** Next.js 16
- **Discovery and signaling:** Vercel WebSockets
- **Transfer:** encrypted WebRTC DataChannels
- **Storage:** none; messages and files remain in browser memory
- **Database:** none
- **Supabase:** not used
- **Room codes or network tokens:** not used

## How discovery works

When a browser opens Throwit, the Vercel WebSocket route sees the request's public network address and places the connection into an internal, SHA-256-derived network group. The raw address is never sent to the browser. Devices sharing the same normal home or office NAT are shown automatically.

The server only relays WebRTC offers, answers, and ICE candidates. File bytes and text messages travel through the direct WebRTC channel.

## Deploy to Vercel

Import this repository into Vercel and deploy. No environment variables are required for a small single-instance deployment.

Vercel WebSocket connections can land on different Function instances when the app scales. For reliable production discovery across instances, add the Upstash Redis integration:

```bash
vercel link
vercel integration add upstash
```

The integration supplies `REDIS_URL` automatically. Redis contains only short-lived presence metadata and signaling events. It never receives files or chat content.

## Local development

WebSocket upgrades use Vercel's runtime, so run:

```bash
npm install
npx vercel dev
```

Plain `next dev` renders the interface but does not provide the production WebSocket upgrade runtime.

## What is implemented

- Automatic device discovery for browsers seen from the same network
- Device type and browser-generated name
- Direct WebRTC connection on device selection
- Text chat with clipboard copy
- File offer with explicit accept or decline
- Chunked file transfer with DataChannel backpressure
- Transfer progress and downloadable received files
- 512 MB in-memory safety limit
- Reconnecting WebSocket client and peer cleanup
- Server-side signaling rate limits and payload limits
- Optional cross-instance Redis presence and relay
- Responsive premium interface using the paper mascot as the only logo

## Browser and network realities

Browsers cannot scan arbitrary LAN devices directly. Like Snapdrop-style applications, Throwit requires a signaling rendezvous to tell browsers which peers exist and to exchange WebRTC connection descriptions.

Devices can fail to appear together when they use different public routes, a VPN, iCloud Private Relay, carrier-grade NAT, isolated guest Wi-Fi, or incompatible IPv4/IPv6 paths. Restricted networks may also require a TURN relay; this version is optimized for normal same-network use and uses public STUN servers.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```
