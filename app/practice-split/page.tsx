"use client"
import useSWR from "swr"
import { TypingArenaSplit } from "@/components/typing-arena-split"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PracticeSplitPage() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const topic = params.get("topic")

  // prefetch examples for fast first render (optional)
  useSWR("/api/examples", fetcher)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-pretty">Java Typing Practice (Split)</h1>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm underline">
              Home
            </a>
            <a href="/practice" className="text-sm underline">
              Overlay Mode
            </a>
          </div>
        </div>
        <TypingArenaSplit topic={topic} api="/api/examples" />
      </div>
    </main>
  )
}
