"use client"
import { useSearchParams } from "next/navigation"
import TypingArenaSplitV2 from "@/components/typing-arena-split-v2"

export default function PracticeSplit2Page() {
  const params = useSearchParams()
  const topic = params.get("topic")
  return <TypingArenaSplitV2 topic={topic} />
}
