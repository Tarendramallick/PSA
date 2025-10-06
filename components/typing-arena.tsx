"use client"

import React from "react"
import useSWR from "swr"
import type { JavaExample } from "@/lib/parse-notes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ExamplesResponse = { examples: JavaExample[]; error?: string }

export function TypingArena() {
  const { data, error, isLoading, mutate } = useSWR<ExamplesResponse>("/api/examples", fetcher, {
    revalidateOnFocus: false,
  })

  const examples = data?.examples ?? []
  const [index, setIndex] = React.useState(0)
  const [duration, setDuration] = React.useState<number>(60)
  const [startedAt, setStartedAt] = React.useState<number | null>(null)
  const [remaining, setRemaining] = React.useState<number>(duration)
  const [typed, setTyped] = React.useState<string>("")
  const [finished, setFinished] = React.useState<boolean>(false)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const current = examples[index] as JavaExample | undefined
  const target = current?.code ?? ""

  // Start timer on first keystroke
  React.useEffect(() => {
    if (!startedAt) return
    setRemaining(Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000)))
    const id = setInterval(() => {
      const left = Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000))
      setRemaining(left)
      if (left <= 0) {
        clearInterval(id)
        setFinished(true)
      }
    }, 250)
    return () => clearInterval(id)
  }, [startedAt, duration])

  // Reset when snippet changes
  React.useEffect(() => {
    setTyped("")
    setStartedAt(null)
    setRemaining(duration)
    setFinished(false)
  }, [index, duration])

  // Ensure focus on mount
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Ensure focus after snippet changes
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [index])

  // Globally redirect keystrokes to hidden textarea unless user is typing in another input
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName?.toLowerCase()
      const isTextInput =
        tag === "input" || tag === "textarea" || (el && "isContentEditable" in el && (el as any).isContentEditable)
      if (!isTextInput) {
        // focus the hidden textarea so typing works immediately
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Enter to advance only when current snippet is perfectly completed
    if (e.key === "Enter" && finished && typed === target) {
      e.preventDefault()
      nextSnippet()
      return
    }

    if (!current) return

    // Start timer on first keystroke
    if (!startedAt) {
      setStartedAt(Date.now())
    }

    // If timer finished, do not accept more input unless it was a perfect finish
    if (finished && typed !== target) {
      e.preventDefault()
      return
    }

    if (e.key === "Backspace") {
      e.preventDefault()
      setTyped((prev) => {
        const next = prev.slice(0, -1)
        if (finished) setFinished(false)
        return next
      })
      return
    }

    const tryType = (str: string) => {
      setTyped((prev) => {
        const idx = prev.length
        const expected = target.slice(idx, idx + str.length)
        if (expected !== str) {
          // do not advance if wrong character (including whitespace)
          return prev
        }
        let next = prev + str

        if (str === "\n") {
          while (next.length < target.length) {
            const ch = target[next.length]
            if (ch === " " || ch === "\t") {
              next += ch
              continue
            }
            break
          }
        }

        const isPerfect = next === target
        if (isPerfect) {
          setFinished(true)
          setTimeout(() => {
            if (next === target) nextSnippet()
          }, 400)
        } else if (finished) {
          setFinished(false)
        }
        return next
      })
    }

    // Printable single character
    if (e.key.length === 1) {
      e.preventDefault()
      tryType(e.key)
      return
    }

    // Enter inserts a newline (strict) and auto-skips indentation
    if (e.key === "Enter") {
      e.preventDefault()
      tryType("\n")
      return
    }

    if (e.key === "Tab") {
      e.preventDefault()
      tryType("\t")
      return
    }
  }

  const correctCount = React.useMemo(() => {
    let c = 0
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === target[i]) c++
    }
    return c
  }, [typed, target])

  const accuracy = typed.length === 0 ? 100 : Math.round((correctCount / typed.length) * 100)
  const elapsedSec = startedAt ? Math.max(1, Math.floor((Date.now() - startedAt) / 1000)) : 0
  const wpm = startedAt ? Math.round(correctCount / 5 / (elapsedSec / 60)) : 0

  const nextSnippet = () => {
    setIndex((i) => (examples.length ? (i + 1) % examples.length : 0))
    // Refocus immediately after advancing
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const prevSnippet = () => {
    setIndex((i) => (examples.length ? (i - 1 + examples.length) % examples.length : 0))
    // Refocus immediately after going back
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const restart = () => {
    setTyped("")
    setStartedAt(null)
    setRemaining(duration)
    setFinished(false)
    // Refocus on restart
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  if (error || data?.error) {
    return (
      <div className="text-center text-sm">
        Failed to load examples.{" "}
        <Button variant="secondary" className="ml-2" onClick={() => mutate()}>
          Retry
        </Button>
      </div>
    )
  }

  if (isLoading || !current) {
    return <div className="text-center text-muted-foreground">Loading examples…</div>
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm px-2 py-1 rounded-md bg-secondary text-secondary-foreground">java-typer</span>
          <span className="text-xs text-muted-foreground">{current.filename}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={`${duration}`} onValueChange={(v) => setDuration(Number.parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Timer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
              <SelectItem value="120">120s</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={prevSnippet}>
            Prev
          </Button>
          <Button size="sm" onClick={nextSnippet}>
            Next
          </Button>
        </div>
      </header>

      <Card className="bg-card/80 border-muted">
        <CardContent className="p-4">
          <div className="flex items-center justify-between pb-3">
            <div className="text-xs text-muted-foreground text-pretty">{current.title}</div>
          </div>

          <div className="relative rounded-md bg-secondary/30 border border-border p-4">
            {/* Visual code block */}
            <div className="h-[55vh] overflow-auto">
              <CodeOverlay
                target={target}
                typed={typed}
                finished={finished}
                onLineClick={(firstNonWSIndex) => {
                  // jump caret to the first non-whitespace of the clicked line
                  setTyped(target.slice(0, firstNonWSIndex))
                  setFinished(false)
                  if (!startedAt) setStartedAt(Date.now())
                  // keep focus for seamless typing
                  setTimeout(() => inputRef.current?.focus(), 0)
                }}
              />
            </div>

            {/* Hidden input to capture keys */}
            <textarea
              aria-label="Typing input"
              className="absolute inset-0 opacity-0"
              autoFocus
              ref={inputRef}
              onBlur={() => {
                // small delay to allow button clicks; then refocus
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
              onKeyDown={onKeyDown}
              value=""
              onChange={() => {}}
            />
          </div>

          <div className="mt-3 text-lg font-mono">
            <span className="text-primary">{remaining}</span>
            <span className="text-muted-foreground">s</span>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={restart}>
                Restart
              </Button>
              <Button onClick={nextSnippet}>Next snippet</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {current.output ? (
        <div className="text-xs text-muted-foreground">
          Expected Output:
          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-secondary/30 p-3 border border-border">
            {current.output}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

function CodeOverlay({
  target,
  typed,
  finished,
  onLineClick,
}: {
  target: string
  typed: string
  finished: boolean
  onLineClick?: (firstNonWSIndex: number) => void
}) {
  const lines = React.useMemo(() => target.split("\n"), [target])

  // Build per-line blocks so the whole line is clickable.
  const blocks: React.ReactNode[] = []
  let globalIndex = 0

  for (let li = 0; li < lines.length; li++) {
    const lineText = lines[li]!
    const lineStart = globalIndex
    const lineEnd = lineStart + lineText.length
    // first non-space/tab index for this line
    let firstNonWS = lineStart
    while (firstNonWS < lineEnd && (target[firstNonWS] === " " || target[firstNonWS] === "\t")) {
      firstNonWS++
    }

    const chars: React.ReactNode[] = []
    for (let i = lineStart; i < lineEnd; i++) {
      const ch = target[i]
      const isTyped = i < typed.length
      const isCorrect = isTyped ? typed[i] === ch : false
      const isCaret = i === typed.length && !finished

      chars.push(
        <span
          key={i}
          className={cn(
            "font-mono text-lg leading-8 md:text-xl md:leading-9",
            !isTyped && "text-muted-foreground/70",
            // purple correct, red incorrect
            isTyped && (isCorrect ? "text-chart-4" : "text-destructive"),
            isCaret && "bg-primary/20 border-b-2 border-primary",
          )}
        >
          {ch === " " ? " " : ch}
        </span>,
      )
    }

    // Caret at the line break (between lines)
    const caretAtLineBreak = typed.length === lineEnd && !finished
    const afterLine = li < lines.length - 1 // there is a newline char in target

    blocks.push(
      <div
        key={`line-${li}`}
        className="group cursor-text"
        onClick={() => {
          if (onLineClick) onLineClick(firstNonWS)
        }}
      >
        {chars}
        {afterLine ? (
          caretAtLineBreak ? (
            // show caret at end-of-line if caret sits on the newline
            <span className="inline-block align-middle bg-primary/20 border-b-2 border-primary"> </span>
          ) : null
        ) : null}
      </div>,
    )

    // advance global index: line text + (implicit '\n' in target except after last line)
    globalIndex = lineEnd + (afterLine ? 1 : 0)
  }

  // Keep pre formatting for wrapping; lines are already blocks
  return <pre className="whitespace-pre-wrap break-words">{blocks}</pre>
}
