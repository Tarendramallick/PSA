"use client"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import TypingArenaV2 from "@/components/typing-arena-v2"
import { deriveTopic, type Topic } from "@/lib/derive-topic"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Example = { id?: string | number; title?: string; filename?: string; code: string }

export default function PracticePage() {
  const search = useSearchParams()
  const selected = (search.get("topic") as Topic | null) || null

  const { data, isLoading, error } = useSWR<{ examples: Example[] }>("/api/examples", fetcher)

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-destructive">Failed to load examples.</p>
      </main>
    )
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Loading examples…</p>
      </main>
    )
  }

  const examples = selected == null ? data.examples : data.examples.filter((e) => deriveTopic(e) === selected)

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-4">
        <h2 className="text-xl font-semibold">{selected ? `Topic: ${selected}` : "All Examples"}</h2>
        <p className="text-sm text-muted-foreground">
          Start typing to begin. Press Enter on a perfect completion to advance.
        </p>
      </header>
      <TypingArenaV2 examples={examples} />
    </main>
  )
}
