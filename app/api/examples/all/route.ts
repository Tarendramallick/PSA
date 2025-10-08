import { NextResponse } from "next/server"

const NOTES_URL =
  "https://raw.githubusercontent.com/pankajmutha14/10th-june-java-notes/main/10th%20June%20java%20-%20psa%20-%20notes.txt"

// Very simple Java class extractor. It will include incomplete ones, by design.
function extractJavaSnippets(raw: string) {
  // Try fenced code blocks first ``` ... ```
  const fenced = Array.from(raw.matchAll(/```(?:java)?([\s\S]*?)```/gi)).map((m) => m[1].trim())
  let candidates = fenced

  if (candidates.length === 0) {
    // Fallback: rough heuristic: capture "class ... { ... }" blocks
    const re = /(?:public\s+)?class\s+[\w$]+\s*\{[\s\S]*?\n\}/g // naive, good enough for lecture notes
    candidates = Array.from(raw.matchAll(re)).map((m) => m[0].trim())
  }

  // As a last fallback, return the whole doc as a single snippet
  if (candidates.length === 0) {
    candidates = [raw.trim()]
  }

  return candidates.map((code, i) => ({
    id: `ex-${i + 1}`,
    title: `Example ${i + 1}`,
    filename: `Example${i + 1}.java`,
    code,
  }))
}

export async function GET() {
  try {
    const res = await fetch(NOTES_URL, { cache: "no-store" })
    const text = await res.text()
    const examples = extractJavaSnippets(text)
    return NextResponse.json({ examples })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to fetch/parse notes" }, { status: 500 })
  }
}
