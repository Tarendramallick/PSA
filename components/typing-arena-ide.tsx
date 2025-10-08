"use client"

import React from "react"
import useSWR from "swr"

type Example = {
  id?: string
  title?: string
  topic?: string
  code: string
  description?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function TypingArenaIDE({
  initialExamples,
  topic,
}: {
  initialExamples?: Example[]
  topic?: string | null
}) {
  const { data } = useSWR<Example[]>("/api/examples", fetcher, {
    fallbackData: initialExamples,
  })

  const all = React.useMemo(() => data || [], [data])
  const examples = React.useMemo(() => {
    if (!topic) return all
    const t = topic.toLowerCase()
    return all.filter((e) => (e.topic || "").toLowerCase() === t || (e.title || "").toLowerCase().includes(t))
  }, [all, topic])

  const [idx, setIdx] = React.useState(0)
  const ex = examples[idx] || { code: "// No examples found", title: "No Examples" }

  // Editor state
  const [typed, setTyped] = React.useState<string>("") // starts EMPTY
  const [started, setStarted] = React.useState(false)
  const [elapsedMs, setElapsedMs] = React.useState(0)
  const timerRef = React.useRef<number | null>(null)

  const taRef = React.useRef<HTMLTextAreaElement | null>(null)

  // Start timer on first keystroke
  React.useEffect(() => {
    if (!started) return
    if (timerRef.current != null) return
    const id = window.setInterval(() => setElapsedMs((ms) => ms + 100), 100)
    timerRef.current = id as unknown as number
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [started])

  // Focus textarea on mount and when switching examples
  React.useEffect(() => {
    taRef.current?.focus()
  }, [idx])

  function resetFor(newIndex: number) {
    setIdx(newIndex)
    setTyped("")
    setStarted(false)
    setElapsedMs(0)
    // focus will trigger via effect
  }

  function onPrev() {
    if (!examples.length) return
    resetFor((idx - 1 + examples.length) % examples.length)
  }

  function onNext() {
    if (!examples.length) return
    resetFor((idx + 1) % examples.length)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Remove Tab=Next behavior entirely
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const before = el.value.substring(0, start)
      const after = el.value.substring(end)
      const insert = "    "
      const next = before + insert + after
      setTyped(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insert.length
      })
      if (!started) setStarted(true)
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const before = el.value.substring(0, start)
      const after = el.value.substring(end)
      const prevLineStart = before.lastIndexOf("\n") + 1
      const prevLine = before.substring(prevLineStart)
      const baseIndent = prevLine.match(/^[\t ]+/)?.[0] ?? ""
      const extra = /{\s*$/.test(prevLine) ? "    " : ""
      const indent = baseIndent + extra
      const insert = "\n" + indent
      const next = before + insert + after
      setTyped(next)
      requestAnimationFrame(() => {
        const pos = start + insert.length
        el.selectionStart = el.selectionEnd = pos
      })
      if (!started) setStarted(true)
      return
    }

    if (!started && e.key.length === 1) {
      setStarted(true)
    }
  }

  async function run(code: string) {
    // normalize newlines for better error line mapping
    const payload = { language: "java", code: normalizeNewlines(code), normalize: true }
    const res = await fetch("/api/compile/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    return json as {
      ok: boolean
      stdout?: string
      stderr?: string
      compile_output?: string
      output?: string
      error?: string
    }
  }

  const [outTyped, setOutTyped] = React.useState<string>("")
  const [outOrig, setOutOrig] = React.useState<string>("")
  const [loading, setLoading] = React.useState<"typed" | "orig" | null>(null)

  async function onRunTyped() {
    setLoading("typed")
    try {
      const r = await run(typed)
      const combined = r.output || r.stdout || r.compile_output || r.stderr || r.error || "No output"
      setOutTyped(combined)
    } catch (err: any) {
      setOutTyped("Error running typed code:\n" + (err?.message || String(err)))
    } finally {
      setLoading(null)
    }
  }

  async function onRunOriginal() {
    setLoading("orig")
    try {
      const r = await run(ex.code || "")
      const combined = r.output || r.stdout || r.compile_output || r.stderr || r.error || "No output"
      setOutOrig(combined)
    } catch (err: any) {
      setOutOrig("Error running original code:\n" + (err?.message || String(err)))
    } finally {
      setLoading(null)
    }
  }

  const timeSecs = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-md bg-muted text-foreground hover:bg-muted/70" onClick={onPrev}>
            Prev
          </button>
          <button className="px-3 py-2 rounded-md bg-muted text-foreground hover:bg-muted/70" onClick={onNext}>
            Next
          </button>
        </div>
        <div className="text-sm text-muted-foreground">Time {timeSecs}s</div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={onRunTyped}
            disabled={loading === "typed"}
          >
            {loading === "typed" ? "Running…" : "Run Typed"}
          </button>
          <button
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={onRunOriginal}
            disabled={loading === "orig"}
          >
            {loading === "orig" ? "Running…" : "Run Original"}
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: EMPTY EDITOR */}
        <section className="rounded-lg border bg-card text-card-foreground">
          <div className="p-3 text-xs text-muted-foreground">Write your Java code here (empty editor)</div>
          <textarea
            ref={taRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-[420px] resize-vertical p-4 font-mono text-[15px] leading-6 bg-background text-foreground outline-none"
            aria-label="Java typing editor"
            placeholder={"// Start typing your Java code...\n"}
          />
        </section>

        {/* RIGHT: ORIGINAL EXAMPLE, READ-ONLY */}
        <section className="rounded-lg border bg-card text-card-foreground">
          <div className="p-3 text-xs text-muted-foreground">
            {ex.title ? ex.title : "Original Example (read-only)"}
          </div>
          <pre className="p-4 font-mono text-[15px] leading-6 whitespace-pre-wrap break-words">{ex.code || ""}</pre>
        </section>
      </main>

      {/* OUTPUTS */}
      <section className="rounded-lg border bg-card text-card-foreground">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-3 border-b md:border-b-0 md:border-r text-sm font-medium">Output (typed)</div>
          <div className="p-3 text-sm font-medium">Output (original)</div>
          <pre className="p-4 whitespace-pre-wrap break-words font-mono text-[14px] leading-6 border-t md:border-t-0 md:border-r">
            {outTyped || "No output"}
          </pre>
          <pre className="p-4 whitespace-pre-wrap break-words font-mono text-[14px] leading-6">
            {outOrig || "No output"}
          </pre>
        </div>
      </section>
    </div>
  )
}

export default TypingArenaIDE
