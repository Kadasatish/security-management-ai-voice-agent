const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

let cachedCerts = null
let cachedCertsExpiresAt = 0

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  }
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env),
  })
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function base64UrlToJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)))
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
}

async function getFirebaseCerts() {
  const now = Date.now()
  if (cachedCerts && cachedCertsExpiresAt > now) return cachedCerts

  const response = await fetch(FIREBASE_CERTS_URL)
  if (!response.ok) throw new Error('Could not load Firebase signing certificates.')

  cachedCerts = await response.json()
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600)
  cachedCertsExpiresAt = now + maxAge * 1000
  return cachedCerts
}

async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token.')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = base64UrlToJson(encodedHeader)
  const payload = base64UrlToJson(encodedPayload)

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Firebase token.')
  if (payload.aud !== projectId) throw new Error('Invalid Firebase token audience.')
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid Firebase token issuer.')
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Invalid Firebase token subject.')
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('Firebase token expired.')
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) throw new Error('Invalid Firebase token time.')

  const certs = await getFirebaseCerts()
  const cert = certs[header.kid]
  if (!cert) throw new Error('Unknown Firebase signing key.')

  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(cert),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!valid) throw new Error('Invalid Firebase token signature.')
  return payload
}

async function requireAuth(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) throw new Error('Missing Firebase authorization token.')
  return verifyFirebaseIdToken(authorization.slice(7).trim(), env.FIREBASE_PROJECT_ID)
}

async function handleAiPlan(request, env) {
  const user = await requireAuth(request, env)
  const body = await request.json().catch(() => null)
  const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : ''

  if (!instruction) return json({ error: 'instruction is required' }, 400, env)
  if (instruction.length > 2000) return json({ error: 'instruction is too long' }, 400, env)

  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) {
    return json({
      error: 'AI backend is not configured yet.',
      userId: user.sub,
    }, 503, env)
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.APP_ORIGIN || '',
      'X-Title': 'Security Management AI Voice Agent',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are the planning layer for a security-management voice agent. Convert the manager instruction into a concise JSON-safe call plan. Do not place a phone call. Return only the task intent, guard name if present, and questions the voice agent should ask.',
        },
        { role: 'user', content: instruction },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    return json({ error: 'OpenRouter request failed.', detail: detail.slice(0, 500) }, 502, env)
  }

  const data = await response.json()
  return json({
    userId: user.sub,
    plan: data.choices?.[0]?.message?.content || '',
  }, 200, env)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) })

    const url = new URL(request.url)

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, service: 'security-ai-voice-agent-api' }, 200, env)
      }

      if (request.method === 'POST' && url.pathname === '/api/ai/plan') {
        return await handleAiPlan(request, env)
      }

      return json({ error: 'Not found' }, 404, env)
    } catch (error) {
      const message = error?.message || 'Request failed.'
      const status = message.includes('Firebase') || message.includes('authorization') ? 401 : 500
      return json({ error: message }, status, env)
    }
  },
}
