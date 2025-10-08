"use client"

import type * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Example = {
  id?: string | number
  title?: string
  code: string
}

function formatMillis(ms: number) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const tenths = Math.floor((ms % 1000) / 100)
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  return `${mm}:${ss}.${tenths}`
}

export function TypingArenaV2({
  examples,
  initialIndex = 0,
  className,
}: {
  examples: Example[]
  initialIndex?: number
  className?: string
}) {
  const [idx, setIdx] = useState(initialIndex)
  const target = examples[idx]?.code ?? ""
  const [typed, setTyped] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const rafRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [runResult, setRunResult] = useState<{
    status?: string
    stdout?: string
    stderr?: string
    compile_output?: string
    message?: string
  } | null>(null)

  // Focus management: always keep input focused
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    focus()
    const onGlobalKey = (e: KeyboardEvent) => {
      // Don't steal focus from other inputs
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return
      focus()
    }
    window.addEventListener("keydown", onGlobalKey)
    return () => window.removeEventListener("keydown", onGlobalKey)
  }, [])

  // Reset when index changes
  useEffect(() => {
    stopTimer()
    setTyped("")
    setElapsedMs(0)
    setStartedAt(null)
    setCompleted(false)
    setAdvancing(false)
    setRunResult(null)
    // refocus
    inputRef.current?.focus()
  }, [idx])

  // Count-up timer driven by rAF
  useEffect(() => {
    if (!isRunning || startedAt === null) return
    const tick = () => {
      setElapsedMs(performance.now() - startedAt)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isRunning, startedAt])

  function startTimerIfNeeded() {
    if (!isRunning) {
      setIsRunning(true)
      setStartedAt(performance.now())
    }
  }
  function stopTimer() {
    setIsRunning(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  // Derived per-char status
  const chars = useMemo(() => target.split(""), [target])
  const statuses = useMemo<("correct" | "incorrect" | "pending")[]>(() => {
    const out: ("correct" | "incorrect" | "pending")[] = []
    for (let i = 0; i < target.length; i++) {
      if (i < typed.length) {
        out.push(typed[i] === target[i] ? "correct" : "incorrect")
      } else {
        out.push("pending")
      }
    }
    return out
  }, [typed, target])

  // Allow clicking a line to skip indentation and jump to first non-whitespace char of that line
  const lines = useMemo(() => target.split("\n"), [target])
  const lineStartIdx: number[] = useMemo(() => {
    const starts: number[] = []
    let acc = 0
    for (const line of lines) {
      starts.push(acc)
      acc += line.length + 1 // +1 for '\n'
    }
    return starts
  }, [lines])

  function handleLineClick(lineIndex: number) {
    const start = lineStartIdx[lineIndex] ?? 0
    const line = lines[lineIndex] ?? ""
    const firstNonWs = start + (line.match(/^\s*/)?.[0].length ?? 0)
    // Allow jumping forward to firstNonWs
    const newLen = Math.max(typed.length, firstNonWs)
    setTyped(target.slice(0, newLen))
    inputRef.current?.focus()
  }

  // Key handling
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (advancing) {
      e.preventDefault()
      return
    }
    const key = e.key

    // Navigation keys still allowed to fix mistakes
    if (key === "Backspace") {
      e.preventDefault()
      if (typed.length > 0) {
        setTyped((prev) => prev.slice(0, -1))
      }
      return
    }
    if (key === "Tab") {
      e.preventDefault()
      if (advancing) return
      stopTimer()
      setAdvancing(true)
      setTimeout(() => {
        setAdvancing(false)
        setIdx((i) => (i + 1) % Math.max(1, examples.length))
      }, 0)
      return
    }
    if (key === "Enter") {
      e.preventDefault()
      // If already perfectly complete, we ignore typing and let auto-advance or manual Enter skip
      if (completed) return
      if (typed.length >= target.length) return
      startTimerIfNeeded()
      // Add newline
      setTyped((prev) => {
        const next = (prev + "\n").slice(0, target.length)
        // After newline, auto-fill any indentation on the next line
        const i = next.length
        // Auto-fill subsequent whitespace to match target
        let j = i
        while (j < target.length && /\s/.test(target[j])) {
          // only fill spaces/tabs at start of the line
          if (target[j] === " " || target[j] === "\t") {
            j++
          } else {
            break
          }
        }
        return target.slice(0, j)
      })
      return
    }

    // Accept only single printable characters as typed content
    if (key.length === 1) {
      if (typed.length >= target.length) {
        e.preventDefault()
        return
      }
      startTimerIfNeeded()
      // Accept wrong letters: do not block; highlight red; must backspace to fix
      setTyped((prev) => (prev + key).slice(0, target.length))
      return
    }

    // Prevent default for other keys to keep focus
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault()
    }
  }

  // Completion check
  useEffect(() => {
    if (typed === target && target.length > 0 && !completed) {
      setCompleted(true)
      stopTimer()
      setAdvancing(true)
      // Auto-advance after 3s
      const t = setTimeout(() => {
        setAdvancing(false)
        setIdx((i) => (i + 1) % Math.max(1, examples.length))
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [typed, target, completed, examples.length])

  // Utility to class names per status
  function charClass(status: "correct" | "incorrect" | "pending") {
    switch (status) {
      case "correct":
        return "text-chart-4" // purple
      case "incorrect":
        return "text-destructive" // red
      default:
        return "text-muted-foreground/60"
    }
  }

  async function handleRun() {
    try {
      setRunLoading(true)
      setRunResult(null)
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: target }),
      })
      const data = await res.json()
      setRunResult(data)
    } catch (e: any) {
      setRunResult({ message: e?.message || "Run failed" })
    } finally {
      setRunLoading(false)
    }
  }

  return (
    <div className={cn("mx-auto max-w-4xl w-full", className)}>
      <div
        className={cn("rounded-lg border border-border bg-card/60 backdrop-blur p-5 md:p-6")}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Header with title and current file index */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground text-pretty">{examples[idx]?.title || "java-snippet.java"}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              {idx + 1} / {examples.length}
            </div>
            <Button size="sm" variant="secondary" onClick={handleRun} disabled={runLoading}>
              {runLoading ? "Running..." : "Run"}
            </Button>
          </div>
        </div>

        {/* Code display */}
        <div className="relative">
          {/* Invisible textarea to capture input */}
          <textarea
            ref={inputRef}
            className="absolute inset-0 opacity-0 pointer-events-none"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onKeyDown={handleKeyDown}
            value={typed}
            onChange={() => {}}
            aria-label="Typing input"
          />
          {/* Render code by lines; enable line click to skip indentation */}
          <pre className="overflow-auto">
            <code className="block whitespace-pre text-[17px] md:text-[18px] leading-7 font-mono">
              {lines.map((line, li) => {
                const start = lineStartIdx[li] ?? 0
                const end = start + line.length
                const before = statuses.slice(start, end)
                const lineChars = chars.slice(start, end)
                const caretIndex = typed.length
                const caretInThisLine = caretIndex >= start && caretIndex <= end
                return (
                  <div
                    key={li}
                    className="cursor-pointer"
                    onClick={() => handleLineClick(li)}
                    role="button"
                    aria-label={`Line ${li + 1}`}
                  >
                    {lineChars.map((ch, i) => {
                      const globalI = start + i
                      const st = before[i] ?? "pending"
                      const isCaret = caretInThisLine && globalI === caretIndex
                      return (
                        <span key={i} className={cn(charClass(st), "select-none")}>
                          {ch === " " ? " " : ch}
                          {isCaret && (
                            <span className="inline-block w-0.5 h-5 align-[-2px] bg-foreground ml-[-1px] animate-pulse" />
                          )}
                        </span>
                      )
                    })}
                    {/* Caret at end of line */}
                    {caretInThisLine && end === typed.length && (
                      <span className="inline-block w-0.5 h-5 align-[-2px] bg-foreground ml-[-1px] animate-pulse" />
                    )}
                  </div>
                )
              })}
            </code>
          </pre>
        </div>

        {/* Timer and run result UI */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isRunning || elapsedMs > 0 ? formatMillis(elapsedMs) : "00:00.0"}
          </div>
          {completed && <div className="text-sm text-muted-foreground">Next in 3s…</div>}
        </div>

        {runResult && (
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            <div className="font-medium mb-1">Status: {runResult.status || "N/A"}</div>
            {runResult.compile_output ? (
              <>
                <div className="font-medium">Compile Output</div>
                <pre className="whitespace-pre-wrap">{runResult.compile_output}</pre>
              </>
            ) : null}
            {runResult.stdout ? (
              <>
                <div className="font-medium mt-2">Stdout</div>
                <pre className="whitespace-pre-wrap">{runResult.stdout}</pre>
              </>
            ) : null}
            {runResult.stderr ? (
              <>
                <div className="font-medium mt-2">Stderr</div>
                <pre className="whitespace-pre-wrap">{runResult.stderr}</pre>
              </>
            ) : null}
            {runResult.message && !runResult.stdout && !runResult.stderr ? (
              <div className="mt-2">{runResult.message}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default TypingArenaV2
