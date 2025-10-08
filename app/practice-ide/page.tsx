"use client"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import TypingArenaIDE from "@/components/typing-arena-ide"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PracticeIDEPage() {
  const params = useSearchParams()
  const topic = params.get("topic")
  const { data } = useSWR("/api/examples", fetcher)

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6 text-pretty">Java Typing Practice (IDE Mode)</h1>
      <TypingArenaIDE initialExamples={data} topic={topic} />
    </main>
  )
}
