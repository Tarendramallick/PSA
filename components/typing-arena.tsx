"use client"

import React from "react"
import useSWR from "swr"
import type { JavaExample } from "@/lib/parse-notes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ExamplesResponse = { examples: JavaExample[]; error?: string }

export function TypingArena() {
  const { data, error, isLoading, mutate } = useSWR<ExamplesResponse>("/api/examples", fetcher, {
    revalidateOnFocus: false,
  })

  const examples = data?.examples ?? []
  const [index, setIndex] = React.useState(0)
  const [startedAt, setStartedAt] = React.useState<number | null>(null)
  const [elapsed, setElapsed] = React.useState<number>(0)
  const [typed, setTyped] = React.useState<string>("")
  const [finished, setFinished] = React.useState<boolean>(false)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const current = examples[index] as JavaExample | undefined
  const target = current?.code ?? ""

  // Replace countdown effect with count-up effect
  React.useEffect(() => {
    if (!startedAt || finished) return
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt!) / 1000)))
    }, 250)
    return () => clearInterval(id)
  }, [startedAt, finished])

  // Reset state on snippet change (remove remaining/duration) and reset elapsed
  React.useEffect(() => {
    setTyped("")
    setStartedAt(null)
    setElapsed(0)
    setFinished(false)
  }, [index])

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
    // allow Enter to skip the 3s wait if already finished
    if (e.key === "Enter" && finished && typed === target) {
      e.preventDefault()
      nextSnippet()
      return
    }

    if (!current) return

    // start timer on first keystroke
    if (!startedAt) setStartedAt(Date.now())

    if (finished) {
      // when finished, ignore additional typing (except Enter above)
      e.preventDefault()
      return
    }

    if (e.key === "Backspace") {
      e.preventDefault()
      setTyped((prev) => prev.slice(0, -1))
      return
    }

    // prevent typing beyond target length
    const at = typed.length
    if (at >= target.length && e.key !== "Backspace") {
      e.preventDefault()
      return
    }

    // printable characters
    if (e.key.length === 1) {
      e.preventDefault()
      setTyped((prev) => {
        const next = prev + e.key
        // check perfect completion (exact match only)
        if (next === target) {
          setFinished(true)
          // auto-advance after 3 seconds
          setTimeout(() => nextSnippet(), 3000)
        }
        return next
      })
      return
    }

    // Enter inserts newline; only auto-skip indentation if it matches the target at caret
    if (e.key === "Enter") {
      e.preventDefault()
      setTyped((prev) => {
        let next = prev
        const idx = prev.length
        const expected = target[idx]
        // insert newline regardless to keep “accept wrong keystrokes” behavior
        next += "\n"
        if (expected === "\n") {
          let j = idx + 1
          while (j < target.length && (target[j] === " " || target[j] === "\t")) {
            next += target[j]
            j++
          }
        }
        if (next.length > target.length) next = next.slice(0, target.length)
        if (next === target) {
          setFinished(true)
          setTimeout(() => nextSnippet(), 3000)
        }
        return next
      })
      return
    }

    // Tab inserts a tab character
    if (e.key === "Tab") {
      e.preventDefault()
      setTyped((prev) => {
        let next = prev + "\t"
        if (next.length > target.length) next = next.slice(0, target.length)
        if (next === target) {
          setFinished(true)
          setTimeout(() => nextSnippet(), 3000)
        }
        return next
      })
      return
    }
  }

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
    setElapsed(0)
    setFinished(false)
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

          <div className="mt-3 font-mono">
            <span className="text-primary text-lg">{elapsed}</span>
            <span className="text-muted-foreground text-lg">s</span>
            {finished ? <span className="ml-3 text-muted-foreground text-sm">Next in 3s…</span> : null}
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

      // Bump font size for readability
      chars.push(
        <span
          key={i}
          className={cn(
            "font-mono text-xl leading-9 md:text-2xl md:leading-10",
            !isTyped && "text-muted-foreground/70",
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
    const afterLine = li < lines.length - 1 // there is a newline char in target except after last line

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
