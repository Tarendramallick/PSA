"use client"

import React from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"

type Example = {
  title?: string
  code: string
  topic?: string
  id?: string | number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function stripComments(java: string) {
  // note: this is heuristic and may strip comment-like text inside strings in rare cases
  const noBlock = java.replace(/\/\*[\s\S]*?\*\//g, "")
  const noLine = noBlock.replace(/(^|\s)\/\/[^\n]*/g, (m) => {
    // keep leading whitespace only
    const leadingWsMatch = m.match(/^\s+/)
    return leadingWsMatch ? leadingWsMatch[0] : ""
  })
  return noLine
}

function useCountdown3s(trigger: boolean, onDone: () => void) {
  const [remaining, setRemaining] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!trigger) return
    setRemaining(3)
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(id)
          onDone()
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [trigger, onDone])
  return remaining
}

export function TypingArenaSplit({
  topic,
  api = "/api/examples", // use your filtered list; switch to /api/examples/all to include incomplete ones
}: {
  topic?: string | null
  api?: string
}) {
  const { data } = useSWR<{ examples: Example[] }>(api, fetcher)
  const all = React.useMemo(() => data?.examples ?? [], [data])

  const examples = React.useMemo(() => {
    if (!topic) return all
    return all.filter((e) => (e.topic || "").toLowerCase() === topic.toLowerCase())
  }, [all, topic])

  const [index, setIndex] = React.useState(0)
  const current = examples[index] || { code: "" }

  // target: we no longer render a ghost target on the right; keep 'original' for left preview only
  const original = React.useMemo(() => normalizeNewlines(current.code || ""), [current])

  // typing state (visible editor content)
  const [typed, setTyped] = React.useState("")
  const [startedAt, setStartedAt] = React.useState<number | null>(null)
  const [stoppedAt, setStoppedAt] = React.useState<number | null>(null)

  // start timer on first keystroke in the visible textarea
  React.useEffect(() => {
    if (!startedAt && typed.length > 0) setStartedAt(Date.now())
  }, [typed, startedAt])

  // focus hidden textarea for global typing
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const focusInput = React.useCallback(() => {
    inputRef.current?.focus()
  }, [])
  React.useEffect(() => {
    focusInput()
    const onKeyDown = (e: KeyboardEvent) => {
      // keep focus unless typing in another input
      const t = e.target as HTMLElement
      const tag = (t?.tagName || "").toLowerCase()
      if (tag === "input" || tag === "textarea" || (t as any).isContentEditable) return
      focusInput()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [focusInput])

  // compile/run
  const [runLoading, setRunLoading] = React.useState<"typed" | "original" | null>(null)
  const [compileOut, setCompileOut] = React.useState<{
    kind: "typed" | "original"
    stdout?: string
    stderr?: string
    error?: string
  } | null>(null)

  async function run(kind: "typed" | "original") {
    try {
      setCompileOut(null)
      setRunLoading(kind)
      const body = { language: "java", version: "latest", code: kind === "typed" ? typed : original }
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCompileOut({ kind, error: json?.error || "Compile API error" })
      } else {
        setCompileOut({
          kind,
          stdout: json?.stdout || json?.combined || "",
          stderr: json?.stderr || json?.compile_output || "",
        })
      }
    } catch (e: any) {
      setCompileOut({ kind, error: e?.message || "Unknown error" })
    } finally {
      setRunLoading(null)
    }
  }

  function resetTimerAndInput() {
    setTyped("")
    setStartedAt(null)
    setStoppedAt(null)
    focusInput()
  }
  function prevSnippet() {
    setIndex((i) => (i - 1 + examples.length) % Math.max(examples.length, 1))
    resetTimerAndInput()
  }
  function nextSnippet() {
    setIndex((i) => (i + 1) % Math.max(examples.length, 1))
    resetTimerAndInput()
  }

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      nextSnippet()
    }
  }

  // compute timer text (unchanged)
  const elapsedMs = React.useMemo(() => {
    if (!startedAt) return 0
    const end = stoppedAt || Date.now()
    return Math.max(0, end - startedAt)
  }, [startedAt, stoppedAt])
  const seconds = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="min-h-[80vh] bg-background text-foreground p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button className="rounded-md border px-3 py-1 text-sm" onClick={prevSnippet} aria-label="Previous snippet">
              Prev
            </button>
            <button className="rounded-md border px-3 py-1 text-sm" onClick={nextSnippet} aria-label="Next snippet">
              Next
            </button>
          </div>
          <div className="text-sm">
            <span>Time {seconds}s</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={cn("rounded-md border px-3 py-1 text-sm", runLoading === "typed" && "opacity-70")}
              onClick={() => run("typed")}
              disabled={runLoading !== null}
            >
              {runLoading === "typed" ? "Running typed…" : "Run Typed"}
            </button>
            <button
              className={cn("rounded-md border px-3 py-1 text-sm", runLoading === "original" && "opacity-70")}
              onClick={() => run("original")}
              disabled={runLoading !== null}
            >
              {runLoading === "original" ? "Running original…" : "Run Original"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: reference code (read-only, original) */}
          <div className="rounded-lg border p-4 bg-card">
            <div className="text-xs text-muted-foreground mb-2">{current.title || "Example"}</div>
            <pre className="font-mono text-sm md:text-base leading-6 whitespace-pre-wrap">{original}</pre>
            <div className="text-xs text-muted-foreground mt-2">
              Comments are visible here; they are not enforced while you type.
            </div>
          </div>

          {/* Right: EMPTY writing area (no ghost text) */}
          <div className="rounded-lg border p-4 bg-card relative">
            <div className="text-xs text-muted-foreground mb-2">Write your Java code here (Tab = Next)</div>
            <textarea
              ref={inputRef}
              className="w-full min-h-[360px] font-mono text-sm md:text-base leading-6 whitespace-pre overflow-auto bg-background text-foreground rounded-md border p-3"
              placeholder="Start typing your code... (no ghost text)"
              value={typed}
              onChange={(e) => setTyped(normalizeNewlines(e.target.value))}
              onKeyDown={onEditorKeyDown}
            />
          </div>
        </div>

        {/* Compile output */}
        {compileOut && (
          <div className="mt-4 rounded-lg border p-4 bg-card">
            <div className="text-sm mb-2">Output ({compileOut.kind})</div>
            {compileOut.error ? (
              <pre className="text-destructive text-sm whitespace-pre-wrap">{compileOut.error}</pre>
            ) : (
              <>
                {compileOut.stdout ? (
                  <>
                    <div className="text-xs text-muted-foreground">stdout</div>
                    <pre className="text-sm whitespace-pre-wrap mb-3">{compileOut.stdout}</pre>
                  </>
                ) : null}
                {compileOut.stderr ? (
                  <>
                    <div className="text-xs text-muted-foreground">stderr</div>
                    <pre className="text-sm whitespace-pre-wrap">{compileOut.stderr}</pre>
                  </>
                ) : null}
                {!compileOut.stdout && !compileOut.stderr ? (
                  <div className="text-xs text-muted-foreground">No output</div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TypingArenaSplit
