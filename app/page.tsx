"use client"

import useSWR from "swr"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { deriveTopic, type Topic } from "@/lib/derive-topic"

type Example = { id?: string | number; title?: string; filename?: string; code: string }
const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function HomePage() {
  const { data, error, isLoading } = useSWR<{ examples: Example[] }>("/api/examples", fetcher)

  const topics = groupTopics(data?.examples || [])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4">
        <SiteHeader />
        <main className="py-6">
          {/* Header */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="text-balance text-2xl font-semibold">Java Typing Practice</h1>
              <p className="text-muted-foreground">
                Choose a topic to start practicing. We’ll load examples directly from your lecture notes.
              </p>
            </div>
            <Link href="/practice">
              <Button variant="secondary">Practice All</Button>
            </Link>
          </div>

          {/* Loading / Error */}
          {error && <p className="text-destructive">Failed to load examples. Please try again.</p>}
          {isLoading && <p className="text-muted-foreground">Loading topics…</p>}

          {/* Topics Grid */}
          {!isLoading && !error && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {/* All */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">All Examples</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{topics._all} snippets</span>
                  <Link href="/practice">
                    <Button size="sm">Start</Button>
                  </Link>
                </CardContent>
              </Card>

              {Object.entries(topics.byTopic).map(([topic, count]) => (
                <Card key={topic}>
                  <CardHeader>
                    <CardTitle className="text-lg">{topic}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{count} snippets</span>
                    <Link href={`/practice?topic=${encodeURIComponent(topic)}`}>
                      <Button size="sm">Start</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
        <footer className="py-6 text-center text-xs text-muted-foreground">
          Notes source: GitHub lecture file. Select a topic to begin.
        </footer>
      </div>
    </div>
  )
}

function groupTopics(examples: Example[]) {
  const counts = new Map<Topic, number>()
  for (const ex of examples) {
    const t = deriveTopic(ex)
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  const byTopic = Object.fromEntries(Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])))
  return {
    _all: examples.length,
    byTopic,
  }
}
