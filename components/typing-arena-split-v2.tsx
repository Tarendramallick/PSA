// NOTE: This is a client component and self-contained so you can drop it into any page.
"use client"

import React from "react"
import useSWR from "swr"

type Example = {
  id?: string
  title?: string
  topic?: string
  filename?: string
  code: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function stripCommentsJava(input: string) {
  // Remove /* ... */ and // ... comments
  return input.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "")
}

function normalizeForCompare(input: string) {
  // Normalize newlines and remove leading indentation per line (alignment-insensitive),
  // but keep internal spaces and tokens strict.
  return input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((ln) => ln.replace(/^\s+/, "")) // drop leading whitespace
    .join("\n")
    .trim()
}

function useCountUpTimer(isRunning: boolean) {
  const [ms, setMs] = React.useState(0)
  React.useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setMs((v) => v + 100), 100)
    return () => clearInterval(id)
  }, [isRunning])
  const seconds = (ms / 1000).toFixed(1)
  const reset = React.useCallback(() => setMs(0), [])
  return { ms, seconds, reset }
}

export default function TypingArenaSplitV2({
  topic,
}: {
  topic?: string | null
}) {
  const { data, error, isLoading } = useSWR<{ examples: Example[] }>("/api/examples", fetcher)

  const [index, setIndex] = React.useState(0)
  const [typed, setTyped] = React.useState("")
  const [running, setRunning] = React.useState(false)
  const [completed, setCompleted] = React.useState(false)
  const [nextIn, setNextIn] = React.useState<number | null>(null)
  const [out, setOut] = React.useState<string>("")
  const [compileLoading, setCompileLoading] = React.useState(false)
  const textRef = React.useRef<HTMLTextAreaElement | null>(null)

  const examples = React.useMemo(() => {
    if (!data?.examples) return []
    const all = data.examples
    if (!topic) return all
    return all.filter((e) => (e.topic || "").toLowerCase() === topic.toLowerCase())
  }, [data, topic])

  const current = examples[index] as Example | undefined
  const originalCode = React.useMemo(() => current?.code ?? "", [current])

  // Derived targets for completion check (ignore comments + leading indentation)
  const targetNormalized = React.useMemo(() => normalizeForCompare(stripCommentsJava(originalCode)), [originalCode])
  const typedNormalized = React.useMemo(() => normalizeForCompare(stripCommentsJava(typed)), [typed])

  const isPerfect = typed.length > 0 && typedNormalized === targetNormalized

  const { seconds, reset: resetTimer } = useCountUpTimer(running)

  // Auto-focus textarea on mount and index change
  React.useEffect(() => {
    textRef.current?.focus()
  }, [index])

  // Start timer on first keystroke
  React.useEffect(() => {
    if (typed.length > 0 && !completed) setRunning(true)
  }, [typed, completed])

  // Handle perfect completion: stop timer, schedule auto-advance in 3s
  React.useEffect(() => {
    if (!isPerfect || completed) return
    setCompleted(true)
    setRunning(false)
    // Countdown for display
    let remaining = 3
    setNextIn(remaining)
    const t = setInterval(() => {
      remaining -= 1
      setNextIn(remaining)
      if (remaining <= 0) {
        clearInterval(t)
        handleNext()
      }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPerfect])

  function handlePrev() {
    if (!examples.length) return
    const nextIdx = (index - 1 + examples.length) % examples.length
    setIndex(nextIdx)
    setTyped("") // writing area starts empty every snippet
    setCompleted(false)
    setRunning(false)
    setOut("")
    setNextIn(null)
    resetTimer()
    textRef.current?.focus()
  }

  function handleNext() {
    if (!examples.length) return
    const nextIdx = (index + 1) % examples.length
    setIndex(nextIdx)
    setTyped("") // writing area starts empty every snippet
    setCompleted(false)
    setRunning(false)
    setOut("")
    setNextIn(null)
    resetTimer()
    textRef.current?.focus()
  }

  async function runCode(kind: "typed" | "original") {
    const codeToRun = kind === "typed" ? typed : originalCode
    if (!codeToRun.trim()) {
      setOut("Nothing to run. Type your code or use Run Original.")
      return
    }
    setCompileLoading(true)
    setOut("")
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "java", code: codeToRun }),
      })
      const json = await res.json()
      // Expecting { compile?: string, stdout?: string, stderr?: string, error?: string }
      const parts = []
      if (json.error) parts.push(`Error:\n${json.error}`)
      if (json.compile) parts.push(`Compile:\n${json.compile}`)
      if (json.stdout) parts.push(`Output:\n${json.stdout}`)
      if (json.stderr) parts.push(`Stderr:\n${json.stderr}`)
      setOut(parts.join("\n\n").trim() || "No output.")
    } catch (e: any) {
      setOut(`Request failed: ${e?.message || String(e)}`)
    } finally {
      setCompileLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault()
      handleNext()
      return
    }
    // Normalize Enter only inserts newline; no double-enter due to CRLF by comparing normalized text
    // We allow any typing; no blocking for “wrong” keys—errors must be corrected by the user.
  }

  if (error) {
    return <div className="p-6 text-destructive">Failed to load examples. Please refresh.</div>
  }

  if (isLoading || !current) {
    return <div className="p-6">Loading examples...</div>
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-pretty text-xl md:text-2xl font-semibold">{current.title || "Java Example"}</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {current.filename || current.topic || "untitled.java"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="inline-flex items-center rounded-md px-3 py-2 text-sm bg-secondary text-secondary-foreground hover:opacity-90"
            aria-label="Previous snippet"
          >
            Prev
          </button>
          <button
            onClick={handleNext}
            className="inline-flex items-center rounded-md px-3 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90"
            aria-label="Next snippet"
          >
            Next
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Left: Original reference (read-only) */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm text-muted-foreground">Original</span>
            <span className="text-xs text-muted-foreground">View only (comments shown)</span>
          </div>
          <pre className="p-3 overflow-auto text-sm md:text-base leading-relaxed">
            <code>{originalCode.replace(/\r\n?/g, "\n")}</code>
          </pre>
        </div>

        {/* Right: Your typing area (starts empty) */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm text-muted-foreground">Your code</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runCode("typed")}
                className="inline-flex items-center rounded-md px-3 py-2 text-xs md:text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={compileLoading}
                aria-label="Run your typed code"
              >
                {compileLoading ? "Running..." : "Run Typed"}
              </button>
              <button
                onClick={() => runCode("original")}
                className="inline-flex items-center rounded-md px-3 py-2 text-xs md:text-sm bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={compileLoading}
                aria-label="Run original example"
              >
                Run Original
              </button>
            </div>
          </div>

          <textarea
            ref={textRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            className="w-full min-h-[360px] md:min-h-[520px] resize-vertical p-3 font-mono text-sm md:text-base leading-relaxed outline-none bg-background"
            placeholder="Start typing the code by looking at the left panel. Alignment/indent doesn’t have to match. Comments are ignored for completion."
            aria-label="Type your code here"
          />

          <div className="border-t px-3 py-2 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Time:</span> <span className="font-medium">{seconds}s</span>
            </div>
            <div className="text-sm">
              {completed ? (
                <span className="text-green-600">
                  Complete{typeof nextIn === "number" ? ` · Next in ${nextIn}s` : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {typed.length === 0 ? "Start typing to start timer" : "Keep going…"}
                </span>
              )}
            </div>
          </div>

          {out && (
            <div className="border-t px-3 py-2">
              <pre className="text-xs md:text-sm whitespace-pre-wrap">{out}</pre>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
