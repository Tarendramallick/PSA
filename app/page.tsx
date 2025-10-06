import { SiteHeader } from "@/components/site-header"
import { TypingArena } from "@/components/typing-arena"

export default function HomePage() {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4">
        <SiteHeader />
        <main className="py-4">
          <TypingArena />
        </main>
        <footer className="py-6 text-center text-xs text-muted-foreground">
          Built for practicing Java code. Notes source: GitHub lecture file.
        </footer>
      </div>
    </div>
  )
}
