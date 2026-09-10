import { importX509, jwtVerify } from 'jose'

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

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function stringToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(value))
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
  if (!token || typeof token !== 'string') throw new Error('Malformed Firebase ID token.')

  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token.')

  const encodedHeader = parts[0]
  let header
  try {
    const normalized = encodedHeader.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    header = JSON.parse(atob(padded))
  } catch {
    throw new Error('Malformed Firebase ID token.')
  }

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Firebase token.')

  const certs = await getFirebaseCerts()
  const cert = certs[header.kid]
  if (!cert) throw new Error('Unknown Firebase signing key.')

  const key = await importX509(cert, 'RS256')
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  })

  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Invalid Firebase token subject.')
  }

  return payload
}

async function requireAuth(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) throw new Error('Missing Firebase authorization token.')
  return verifyFirebaseIdToken(authorization.slice(7).trim(), env.FIREBASE_PROJECT_ID)
}

async function createLiveKitToken({ apiKey, apiSecret, identity, roomName }) {
  const now = Math.floor(Date.now() / 1000)
  const header = stringToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = stringToBase64Url(JSON.stringify({
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + 60 * 30,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    },
  }))
  const unsignedToken = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(unsignedToken),
  )

  return `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`
}

async function handleLiveKitToken(request, env) {
  const user = await requireAuth(request, env)
  const body = await request.json().catch(() => null)
  const roomName = typeof body?.roomName === 'string' ? body.roomName.trim() : ''
  const role = body?.role === 'guard' ? 'guard' : body?.role === 'manager' ? 'manager' : ''

  if (!roomName || roomName.length > 128) {
    return json({ error: 'roomName is required and must be 128 characters or fewer.' }, 400, env)
  }
  if (!role) return json({ error: 'role must be manager or guard.' }, 400, env)

  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return json({ error: 'LiveKit backend is not configured yet.' }, 503, env)
  }

  const identity = `user_${user.sub}_${role}`
  const participantToken = await createLiveKitToken({
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    identity,
    roomName,
  })

  return json({
    server_url: env.LIVEKIT_URL,
    participant_token: participantToken,
  }, 200, env)
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

      if (request.method === 'POST' && url.pathname === '/api/livekit/token') {
        return await handleLiveKitToken(request, env)
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
