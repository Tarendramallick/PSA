"use client"

import TypingArenaV3 from "@/components/typing-arena-v3"

export default function Page() {
  // Default to light UI by ensuring the 'dark' class is not present (handled inside TypingArenaV3)
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <TypingArenaV3 />
    </main>
  )
}
