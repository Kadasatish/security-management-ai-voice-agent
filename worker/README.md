# Security AI Worker

This Cloudflare Worker is the secure backend boundary for the PWA.

## Endpoints

- `GET /health` — public health check.
- `POST /api/ai/plan` — requires a Firebase ID token in `Authorization: Bearer <token>` and sends the manager instruction to OpenRouter when the Worker secret is configured.

## Secrets

Configure these in Cloudflare Worker secrets/variables, never in the React app or GitHub source:

- `OPENROUTER_API_KEY` — secret OpenRouter API key.
- `OPENROUTER_MODEL` — the OpenRouter model ID to use.

`FIREBASE_PROJECT_ID` and `APP_ORIGIN` are non-secret Worker variables in `wrangler.toml`.

## Local/deploy

From the `worker` directory, use Wrangler. Do not commit `.dev.vars` or API keys.
