# Throwit

A Snapdrop-style local sharing app with a custom throw interaction.

## Architecture

- Next.js on Vercel
- Upstash Redis REST for short-lived presence and WebRTC signaling
- WebRTC DataChannels for direct file and text transfer
- No Supabase, database tables, accounts, room codes, or client network tokens
- Files and text never pass through Redis or Vercel

## Why Redis is required

Browsers cannot scan arbitrary devices on Wi-Fi. A small rendezvous service is required to announce browser presence and exchange WebRTC offers, answers, and ICE candidates. Vercel Functions do not share reliable in-memory state across instances, so Throwit uses serverless Redis REST for this short-lived coordination.

The client never receives a network token. The server groups requests by a one-way hash of the public network address and stores presence for only a few seconds.

## Deploy

1. Import the repository into Vercel.
2. In the Vercel project, open **Storage → Create Database → Upstash Redis**.
3. Connect it to the project. Vercel adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically.
4. Redeploy.

No other environment variables are required.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Use an Upstash Redis database for local cross-device testing. HTTPS is required on physical devices for the full browser feature set.

## Features

- Automatic same-network browser discovery
- Direct encrypted WebRTC file transfer
- Temporary text chat
- Explicit file acceptance
- Chunked transfer with progress and backpressure
- Up to 512 MB in-memory receive limit
- Paper mascot navigation logo and favicon
- Responsive orbit-based device interface
