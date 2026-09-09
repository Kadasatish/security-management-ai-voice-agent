import { useMemo, useState } from 'react'

const demoReports = [
  {
    id: 'demo-1',
    guard: 'Satish',
    status: 'Scheduled',
    detail: 'No call has been placed yet.',
  },
]

function App() {
  const [mode, setMode] = useState('manager')
  const [instruction, setInstruction] = useState('')
  const [delay, setDelay] = useState('10')
  const [reports, setReports] = useState(demoReports)
  const [notice, setNotice] = useState('')

  const activeTitle = useMemo(
    () => (mode === 'manager' ? 'Manager Dashboard' : 'Guard Dashboard'),
    [mode],
  )

  const scheduleCall = () => {
    if (!instruction.trim()) {
      setNotice('Enter an instruction first.')
      return
    }

    setNotice(`Call request queued for ${delay} minutes. Voice backend will be connected next.`)
    setReports((current) => [
      {
        id: crypto.randomUUID(),
        guard: 'Satish',
        status: 'Queued',
        detail: `AI call requested: ${instruction.trim()}`,
      },
      ...current,
    ])
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="safe-top border-b border-slate-800 bg-slate-950/95 px-4 pb-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Security AI</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">AI Voice Agent</h1>
          </div>
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            PWA prototype
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-slate-800 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setMode('manager')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === 'manager' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Manager
          </button>
          <button
            type="button"
            onClick={() => setMode('guard')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === 'guard' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Guard — Satish
          </button>
        </div>

        {mode === 'manager' ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-7">
              <div className="mb-6">
                <p className="text-sm font-medium text-cyan-400">{activeTitle}</p>
                <h2 className="mt-2 text-2xl font-bold">Give the AI a voice-call task</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Example: “Satishకి 10 నిమిషాల తర్వాత call చేసి, ఈరోజు security dutyకి వస్తాడా అని అడుగు. అతను చెప్పినది report చేయి.”
                </p>
              </div>

              <label className="block text-sm font-medium text-slate-300" htmlFor="instruction">
                AI instruction
              </label>
              <textarea
                id="instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Tell the AI what to ask the guard..."
                rows={4}
                className="mt-2 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-40">
                  <label className="text-sm font-medium text-slate-300" htmlFor="delay">Call after</label>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
                    <input
                      id="delay"
                      type="number"
                      min="1"
                      max="60"
                      value={delay}
                      onChange={(event) => setDelay(event.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                    />
                    <span className="text-xs text-slate-500">min</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={scheduleCall}
                  className="rounded-2xl bg-cyan-500 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 active:scale-[0.99] sm:flex-1"
                >
                  Schedule AI Voice Call
                </button>
              </div>

              {notice && (
                <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
                  {notice}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-400">Manager reports</p>
                  <h3 className="mt-1 text-xl font-bold">AI call results</h3>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">{reports.length}</span>
              </div>
              <div className="mt-5 space-y-3">
                {reports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold">{report.guard}</h4>
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">{report.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{report.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-7">
            <p className="text-sm font-medium text-cyan-400">{activeTitle}</p>
            <h2 className="mt-2 text-2xl font-bold">Satish</h2>
            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/10 text-3xl">☎</div>
              <h3 className="mt-5 text-xl font-bold">Waiting for an AI call</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                In the next phase this screen will receive the real LiveKit incoming call. Accepting it will start the AI ↔ Guard voice conversation.
              </p>
              <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-4 text-left text-xs leading-5 text-slate-500">
                LiveKit connection: not configured yet
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="safe-bottom mx-auto max-w-5xl px-4 pb-6 pt-2 text-center text-xs text-slate-600">
        React + Vite + Tailwind + PWA · Voice backend will be connected after the UI foundation is verified.
      </footer>
    </div>
  )
}

export default App
