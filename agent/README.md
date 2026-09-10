# Security AI Voice Agent

This directory contains the realtime LiveKit Agent for the Security Management PWA.

## Architecture

PWA -> LiveKit room -> LiveKit Agent -> STT -> OpenRouter LLM -> TTS -> LiveKit room

The OpenRouter API key stays on the agent/server side. It is never sent to the browser.

## Local setup

Requirements:
- Python 3.10+
- LiveKit Cloud project
- OpenRouter API key

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in the LiveKit credentials and `OPENROUTER_API_KEY`. Keep `.env.local` private.

Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the agent:

```bash
lk agent dev agent.py
```

The registered agent name is `security-ai-agent`.

## Important

This is the first realtime AI-agent layer. It does not yet implement the 10-minute scheduler, OK/NO data actions, manager reports, or PSTN/SIP calling. Those are added after the basic OpenRouter-powered voice conversation is verified.
