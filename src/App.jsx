import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  getIdToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { LiveKitRoom, RoomAudioRenderer, ControlBar } from '@livekit/components-react'
import { auth, db } from './firebase.js'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL
const VOICE_TOKEN_ENDPOINT = import.meta.env.VITE_VOICE_TOKEN_ENDPOINT || 'https://security-ai-voice-agent-api.kadasatish2022.workers.dev/api/livekit/token'
const TEST_ROOM = 'security-ai-live-test'

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) await createUserWithEmailAndPassword(auth, email.trim(), password)
      else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(err?.message || 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Security AI</p>
        <h1 className="mt-2 text-2xl font-bold">AI Voice Agent</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Sign in to connect this PWA to Firebase.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm outline-none focus:border-cyan-500" />
          <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (6+ characters)" className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm outline-none focus:border-cyan-500" />
          {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <button type="submit" disabled={busy} className="w-full rounded-2xl bg-cyan-500 px-5 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-50">{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
        <button type="button" onClick={() => { setIsRegister((value) => !value); setError('') }} className="mt-4 w-full text-sm text-cyan-300">{isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      </div>
    </div>
  )
}

function VoiceRoom({ token, role, onLeave }) {
  return (
    <div className="mt-5 rounded-3xl border border-cyan-500/30 bg-slate-950 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-400">LiveKit connected</p>
          <p className="mt-1 text-sm font-semibold">{role === 'manager' ? 'Manager voice test' : 'Guard voice test'}</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">LIVE</span>
      </div>
      <LiveKitRoom token={token} serverUrl={LIVEKIT_URL} connect={true} audio={true} video={false} onDisconnected={onLeave} onError={(error) => console.error(error)}>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-300">Microphone is available. Open this PWA in another browser context and join the same test room to verify two-way voice.</p>
          <div className="mt-4"><ControlBar controls={{ microphone: true, camera: false, screenShare: false }} /></div>
        </div>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('manager')
  const [instruction, setInstruction] = useState('')
  const [delay, setDelay] = useState('10')
  const [reports, setReports] = useState([])
  const [notice, setNotice] = useState('')
  const [voiceToken, setVoiceToken] = useState('')
  const [voiceBusy, setVoiceBusy] = useState(false)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  useEffect(() => {
    if (!user) {
      setReports([])
      return undefined
    }
    return onSnapshot(collection(db, 'callRequests'), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      next.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setReports(next)
    }, (error) => setNotice(error.message))
  }, [user])

  const activeTitle = useMemo(() => (mode === 'manager' ? 'Manager Dashboard' : 'Guard Dashboard'), [mode])

  const joinVoiceTest = async () => {
    setNotice('')
    if (!LIVEKIT_URL) {
      setNotice('LiveKit URL is missing from the production build.')
      return
    }
    setVoiceBusy(true)
    try {
      const firebaseToken = await getIdToken(user, true)
      const response = await fetch(VOICE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${firebaseToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: TEST_ROOM, role: mode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not get a LiveKit token.')
      setVoiceToken(data.participant_token)
    } catch (error) {
      setNotice(error?.message || 'Could not start LiveKit voice test.')
    } finally {
      setVoiceBusy(false)
    }
  }

  const leaveVoiceTest = () => setVoiceToken('')

  const scheduleCall = async () => {
    if (!instruction.trim()) {
      setNotice('Enter an instruction first.')
      return
    }
    const minutes = Number(delay)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) {
      setNotice('Call delay must be between 1 and 60 minutes.')
      return
    }
    try {
      const scheduledFor = new Date(Date.now() + minutes * 60 * 1000)
      await addDoc(collection(db, 'callRequests'), {
        guard: 'Satish',
        instruction: instruction.trim(),
        delayMinutes: minutes,
        scheduledFor,
        status: 'Queued',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      setNotice(`Call request saved. Scheduled for ${scheduledFor.toLocaleString()}.`)
      setInstruction('')
    } catch (error) {
      setNotice(error?.message || 'Could not save the call request.')
    }
  }

  if (!user) return <AuthScreen />

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="safe-top border-b border-slate-800 bg-slate-950/95 px-4 pb-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Security AI</p><h1 className="mt-1 text-xl font-bold tracking-tight">AI Voice Agent</h1></div>
          <div className="flex items-center gap-2"><div className="hidden max-w-40 truncate rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 sm:block">{user.email}</div><button type="button" onClick={() => signOut(auth)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">Sign out</button></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-slate-800 bg-slate-900 p-1">
          <button type="button" onClick={() => { setMode('manager'); leaveVoiceTest() }} className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === 'manager' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Manager</button>
          <button type="button" onClick={() => { setMode('guard'); leaveVoiceTest() }} className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === 'guard' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Guard — Satish</button>
        </div>

        {mode === 'manager' ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-7">
              <div className="mb-6"><p className="text-sm font-medium text-cyan-400">{activeTitle}</p><h2 className="mt-2 text-2xl font-bold">Give the AI a voice-call task</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Example: “Satishకి 10 నిమిషాల తర్వాత call చేసి, ఈరోజు security dutyకి వస్తాడా అని అడుగు. అతను చెప్పినది report చేయి.”</p></div>
              <label className="block text-sm font-medium text-slate-300" htmlFor="instruction">AI instruction</label>
              <textarea id="instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Tell the AI what to ask the guard..." rows={4} className="mt-2 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="sm:w-40"><label className="text-sm font-medium text-slate-300" htmlFor="delay">Call after</label><div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3"><input id="delay" type="number" min="1" max="60" value={delay} onChange={(event) => setDelay(event.target.value)} className="w-full bg-transparent text-sm outline-none" /><span className="text-xs text-slate-500">min</span></div></div><button type="button" onClick={scheduleCall} className="rounded-2xl bg-cyan-500 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 active:scale-[0.99] sm:flex-1">Schedule AI Voice Call</button></div>
              {notice && <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">{notice}</div>}
              {!voiceToken && <button type="button" disabled={voiceBusy} onClick={joinVoiceTest} className="mt-5 w-full rounded-2xl border border-cyan-500/40 px-5 py-3.5 text-sm font-bold text-cyan-300 disabled:opacity-50">{voiceBusy ? 'Connecting…' : 'Start LiveKit Voice Test'}</button>}
              {voiceToken && <VoiceRoom token={voiceToken} role={mode} onLeave={leaveVoiceTest} />}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-400">Manager reports</p><h3 className="mt-1 text-xl font-bold">AI call results</h3></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">{reports.length}</span></div><div className="mt-5 space-y-3">{reports.length === 0 && <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">No call requests yet.</p>}{reports.map((report) => <article key={report.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold">{report.guard}</h4><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">{report.status}</span></div><p className="mt-2 text-sm leading-6 text-slate-400">{report.instruction}</p></article>)}</div></div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-7">
            <p className="text-sm font-medium text-cyan-400">{activeTitle}</p><h2 className="mt-2 text-2xl font-bold">Satish</h2>
            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/10 text-3xl">☎</div><h3 className="mt-5 text-xl font-bold">LiveKit voice test</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Join the same test room from another browser context to verify real two-way microphone audio.</p>{!voiceToken && <button type="button" disabled={voiceBusy} onClick={joinVoiceTest} className="mt-6 w-full rounded-2xl bg-cyan-500 px-5 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-50">{voiceBusy ? 'Connecting…' : 'Join LiveKit Voice Test'}</button>}{voiceToken && <VoiceRoom token={voiceToken} role={mode} onLeave={leaveVoiceTest} />}</div>
          </section>
        )}
      </main>
      <footer className="safe-bottom mx-auto max-w-5xl px-4 pb-6 pt-2 text-center text-xs text-slate-600">React + Vite + Tailwind + PWA · Firebase Auth + Firestore + LiveKit.</footer>
    </div>
  )
}

export default App
