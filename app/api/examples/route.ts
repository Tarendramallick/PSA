import type { NextRequest } from "next/server"
import { parseJavaExamples } from "@/lib/parse-notes"

const NOTES_RAW_URL =
  "https://raw.githubusercontent.com/pankajmutha14/10th-june-java-notes/main/10th%20June%20java%20-%20psa%20-%20notes.txt"

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(NOTES_RAW_URL, { cache: "no-store" })
    if (!res.ok) {
      return Response.json({ error: "Failed to fetch notes" }, { status: 502 })
    }
    const text = await res.text()
    const examples = parseJavaExamples(text)

    // Basic curation: prefer snippets within a reasonable size range
    const curated = examples.filter((e) => e.code.length >= 60 && e.code.length <= 2500).slice(0, 100)

    return Response.json({ examples: curated })
  } catch (err) {
    return Response.json({ error: "Unexpected error", detail: `${err}` }, { status: 500 })
  }
}
