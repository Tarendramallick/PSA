"use client"
import useSWR from "swr"
import TypingArenaV2 from "@/components/typing-arena-v2"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Example = { id?: string | number; title?: string; code: string }

export default function PracticePage() {
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

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <TypingArenaV2 examples={data.examples} />
    </main>
  )
}
