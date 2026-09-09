# Security Management AI Voice Agent

PWA proof-of-concept for an AI voice agent that can schedule and conduct a voice conversation with a security guard, then return a concise report to the manager.

## Stack

- React
- Vite
- Tailwind CSS v4
- PWA via vite-plugin-pwa
- Firebase (planned)
- Cloudflare Worker (planned secure backend)
- OpenRouter (planned AI layer)
- LiveKit Cloud (planned realtime voice layer)

## First demo flow

Manager gives an instruction → schedule a call → Guard receives an in-app call → AI and Guard have a real voice conversation → result is stored → Manager sees the report.

No attendance/duty engine is included in this first proof-of-concept.
