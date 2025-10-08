"use client"

import React from "react"
import useSWR from "swr"

type Example = { id: string; title: string; filename: string; code: string }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function TypingArenaV3() {
  const { data } = useSWR<{ examples: Example[] }>("/api/examples/all", fetcher)
  const examples = data?.examples || []

  const [index, setIndex] = React.useState(0)
  const [typed, setTyped] = React.useState("")
  const [started, setStarted] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [ms, setMs] = React.useState(0)
  const [nextIn, setNextIn] = React.useState<number | null>(null)
  const [output, setOutput] = React.useState<{
    status?: string
    stdout?: string
    stderr?: string
    compile_output?: string
    message?: string
    error?: string
  } | null>(null)

  const areaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const startTsRef = React.useRef<number | null>(null)
  const lastTickRef = React.useRef<number | null>(null)

  const current = examples[index] || null
  const target = current?.code ?? ""
  const displayTarget = React.useMemo(() => (target || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), [target])

  // Force light/white UI by default
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  // Autofocus text area
  React.useEffect(() => {
    areaRef.current?.focus()
  }, [index])

  React.useEffect(() => {
    areaRef.current?.focus()
  }, [])

  // Count-up timer using rAF once typing starts
  const tick = React.useCallback(
    (ts: number) => {
      if (!started || done) return
      if (startTsRef.current == null) startTsRef.current = ts
      if (lastTickRef.current == null) lastTickRef.current = ts
      setMs(Math.max(0, Math.round(ts - startTsRef.current)))
      rafRef.current = requestAnimationFrame(tick)
    },
    [started, done],
  )

  React.useEffect(() => {
    if (started && !done) {
      rafRef.current = requestAnimationFrame(tick)
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }
  }, [started, done, tick])

  // Auto-advance 3s after perfect completion
  React.useEffect(() => {
    if (!done) return
    setNextIn(3)
    let n = 3
    const id = setInterval(() => {
      n -= 1
      setNextIn(n)
      if (n <= 0) {
        clearInterval(id)
        next()
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function resetFor(i: number) {
    setIndex(i)
    setTyped("")
    setStarted(false)
    setDone(false)
    setMs(0)
    setNextIn(null)
    setOutput(null)
    startTsRef.current = null
    lastTickRef.current = null
    requestAnimationFrame(() => areaRef.current?.focus())
  }

  function next() {
    const nx = (index + 1) % Math.max(1, examples.length)
    resetFor(nx)
  }

  function prev() {
    const pv = (index - 1 + Math.max(1, examples.length)) % Math.max(1, examples.length)
    resetFor(pv)
  }

  // Strict char-by-char typing:
  // - Accept any keystroke, append it
  // - Show mismatches in red
  // - Only perfect equality marks completion
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!started && e.key.length === 1) {
      setStarted(true)
    }

    if (done) {
      // Allow Enter to skip the 3s wait
      if (e.key === "Enter") {
        e.preventDefault()
        next()
      }
      return
    }

    // Navigation helpers
    if (e.key === "ArrowRight" && e.ctrlKey) {
      e.preventDefault()
      next()
      return
    }
    if (e.key === "ArrowLeft" && e.ctrlKey) {
      e.preventDefault()
      prev()
      return
    }

    // Backspace
    if (e.key === "Backspace") {
      e.preventDefault()
      if (typed.length > 0) setTyped((s) => s.slice(0, -1))
      return
    }

    // Tab inserts a tab literal
    if (e.key === "Tab") {
      e.preventDefault()
      next()
      return
    }

    // Enter inserts newline
    if (e.key === "Enter") {
      e.preventDefault()
      setTyped((s) => (s.length < displayTarget.length ? s + "\n" : s))
      return
    }

    // Other single-character keys
    if (e.key.length === 1) {
      e.preventDefault()
      setTyped((s) => (s.length < displayTarget.length ? s + e.key : s))
      return
    }
  }

  // Completion check: only if perfectly equal
  React.useEffect(() => {
    if (!displayTarget) return
    if (typed === displayTarget) {
      setDone(true)
    }
  }, [typed, displayTarget])

  // Compile/run via API
  async function runCurrent() {
    if (!current) return
    setOutput(null)
    try {
      const r = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: target }),
      })
      const json = await r.json()
      setOutput(json)
    } catch (err: any) {
      setOutput({ message: err?.message || "Run failed", error: err?.message })
    }
  }

  // Render helpers
  function renderChars() {
    const spans: React.ReactNode[] = []
    const tlen = typed.length

    for (let i = 0; i < displayTarget.length; i++) {
      const ch = displayTarget[i]
      let cls = "text-muted-foreground"

      if (i < tlen) {
        cls = typed[i] === ch ? "text-chart-4" : "text-destructive"
      }

      spans.push(
        <span key={i} className={cls}>
          {ch === " " ? "·" : ch}
        </span>,
      )
    }

    // caret
    if (!done) {
      spans.splice(
        Math.min(tlen, displayTarget.length),
        0,
        <span key="caret" className="bg-foreground/80 w-[1px] h-5 inline-block align-text-bottom mx-[1px]" />,
      )
    }

    return spans
  }

  function seconds(ms: number) {
    return (ms / 1000).toFixed(1) + "s"
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col items-center">
      <header className="w-full max-w-4xl px-6 py-4 flex items-center justify-between">
        <div className="font-mono text-sm opacity-70">{current?.filename || "Loading..."}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            className="rounded-md px-3 py-1.5 border border-border text-sm hover:bg-accent"
            aria-label="Previous example"
          >
            Prev
          </button>
          <button
            onClick={next}
            className="rounded-md px-3 py-1.5 border border-border text-sm hover:bg-accent"
            aria-label="Next example"
          >
            Next
          </button>
          <button
            onClick={runCurrent}
            className="rounded-md px-3 py-1.5 border border-border text-sm hover:bg-accent"
            aria-label="Compile & Run Java"
          >
            Run
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl px-6">
        <div className="relative rounded-xl border border-border bg-card p-5">
          <pre className="font-mono text-[17px] leading-7 whitespace-pre-wrap" aria-label="Typing code">
            {renderChars()}
          </pre>

          <textarea
            ref={areaRef}
            onKeyDown={onKeyDown}
            value={typed}
            onChange={() => {}}
            aria-label="Hidden typing input"
            className="absolute inset-0 opacity-0 pointer-events-none"
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm font-mono">
            {started && !done ? seconds(ms) : !started ? "0.0s" : seconds(ms)}
            {done ? " • Next in 3s…" : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            Click a line to jump to its first non-whitespace, or Ctrl+←/→ to switch examples.
          </div>
        </div>

        {output && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Run Output</div>
            {output.status && <div className="text-xs mb-1">Status: {output.status}</div>}
            {"error" in (output as any) && (output as any).error ? (
              <pre className="font-mono text-sm whitespace-pre-wrap text-destructive">{(output as any).error}</pre>
            ) : null}
            {output.stdout ? (
              <pre className="font-mono text-sm whitespace-pre-wrap text-foreground">{output.stdout}</pre>
            ) : null}
            {output.stderr ? (
              <pre className="font-mono text-sm whitespace-pre-wrap text-destructive">{output.stderr}</pre>
            ) : null}
            {output.compile_output ? (
              <pre className="font-mono text-sm whitespace-pre-wrap text-destructive">{output.compile_output}</pre>
            ) : null}
            {output.message && !output.stdout && !output.stderr && !output.compile_output ? (
              <pre className="font-mono text-sm whitespace-pre-wrap">{output.message}</pre>
            ) : null}
          </div>
        )}
      </main>
    </div>
  )
}
