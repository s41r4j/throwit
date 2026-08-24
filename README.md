# Throwit

A Snapdrop-style local sharing app with a custom throw interaction.

## Architecture

- Next.js on Vercel
- Upstash Redis REST for short-lived presence and WebRTC signaling
- WebRTC DataChannels for direct file and text transfer
- No Supabase, database tables, accounts, or permanent room codes
- Files and text never pass through Redis or Vercel

## Discovery model

Browsers cannot scan arbitrary devices on Wi-Fi. Throwit therefore uses a small rendezvous service to announce browser presence and exchange WebRTC offers, answers, and ICE candidates.

In **Local** mode, the server groups devices using a one-way hash of the public network address. This works well when devices share the same normal Wi-Fi NAT/public address. IPv6 clients are grouped by their /64 network prefix so devices on the same IPv6 Wi-Fi/hotspot prefix are not separated merely because their interface IDs differ.

Mobile hotspots are different. The phone creating the hotspot and devices tethered through it are not guaranteed to reach Vercel from the same public address or address family, and some carriers use CGNAT/IPv6 translation or client isolation. Therefore automatic Local discovery cannot be guaranteed for hotspot-host ↔ hotspot-client pairs.

For hotspot use, enable **Hotspot** mode and share the generated link. The `space` token in that link gives both browsers the same short-lived rendezvous scope regardless of their public IP. File/text payloads still travel over WebRTC rather than through Redis.

## WebRTC connectivity note

Throwit currently uses public STUN servers and attempts a direct peer-to-peer path. Some carrier, enterprise, symmetric-NAT, or isolated-hotspot networks may still prevent a direct WebRTC route even after discovery succeeds. Production-grade reliability across those networks requires a TURN relay. TURN relays encrypted WebRTC traffic when a direct path cannot be established.

## Why Redis is required

Vercel Functions do not share reliable in-memory state across instances, so Throwit uses serverless Redis REST for short-lived presence and signaling coordination.

The client never receives the automatically derived network scope. Presence is retained for only a few seconds.

## Deploy

1. Import the repository into Vercel.
2. In the Vercel project, open **Storage → Create Database → Upstash Redis**.
3. Connect it to the project. Vercel adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically.
4. Redeploy.

No other environment variables are required for the current STUN-only setup.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Use an Upstash Redis database for local cross-device testing. HTTPS is required on physical devices for the full browser feature set.

## Features

- Automatic same-public-network browser discovery
- Shared-link hotspot rendezvous mode
- Direct encrypted WebRTC file transfer
- Temporary text chat
- Explicit file acceptance
- Chunked transfer with progress and backpressure
- Up to 512 MB in-memory receive limit
- Paper mascot navigation logo and favicon
- Responsive orbit-based device interface
