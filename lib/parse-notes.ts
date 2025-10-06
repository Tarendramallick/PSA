export type JavaExample = {
  title: string
  filename: string
  code: string
  output?: string
}

const CLASS_BLOCK_REGEX = /(public\s+class|class)\s+([A-Za-z_$][\w$]*)\s*{[\s\S]*?}\s*/gim

export function parseJavaExamples(notes: string): JavaExample[] {
  const results: JavaExample[] = []
  const seen = new Set<string>()

  // Extract candidate class blocks
  let match: RegExpExecArray | null
  while ((match = CLASS_BLOCK_REGEX.exec(notes)) !== null) {
    const full = match[0]
    const className = match[2] || "Example"
    const startIdx = match.index
    const endIdx = startIdx + full.length

    // Look ahead for an Output/Ouput section close to this example (up to next 1200 chars)
    const lookahead = notes.slice(endIdx, Math.min(notes.length, endIdx + 1200))
    const outputMatch = /\b(Out\s*put|Ouput|Output)\s*:\s*([\s\S]*?)(?:\n\s*\n|^|\n-{2,}|Example|\bNote\b)/i.exec(
      lookahead,
    )
    const output = outputMatch ? sanitize(outputMatch[2]) : undefined

    // Also check local annotation lines around the block for “Will give error”
    const around = notes.slice(Math.max(0, startIdx - 300), Math.min(notes.length, endIdx + 300))

    // Filtering rule: exclude if output mentions error or surrounding notes say "Will give error"
    const hasErrorOutput = (output && /error/i.test(output)) || /will\s+give\s+error/i.test(around)

    if (hasErrorOutput) continue

    // Title: nearest "Example" line above, else class name
    const priorChunk = notes.slice(Math.max(0, startIdx - 400), startIdx)
    const titleLineMatch = /Example[^\n]*$/im.exec(priorChunk)
    const rawTitle = titleLineMatch ? titleLineMatch[0].trim() : `Example - ${className}.java`

    const code = cleanupIndentation(full)
    const key = `${className}:${hash(code)}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      title: rawTitle,
      filename: `${className}.java`,
      code,
      output,
    })
  }

  // If nothing found, fallback: try to pull smaller snippets that still look like Java
  if (results.length === 0) {
    const fallback = extractInlineJava(notes)
    fallback.forEach((f) => {
      const key = `${f.filename}:${hash(f.code)}`
      if (!/error/i.test(f.output || "") && !seen.has(key)) {
        seen.add(key)
        results.push(f)
      }
    })
  }

  return results
}

function cleanupIndentation(code: string) {
  // Normalize tabs to 2 spaces and trim excessive leading/trailing newlines
  const normalized = code.replace(/\t/g, "  ").replace(/\r\n/g, "\n")
  return normalized.replace(/^\s*\n+/, "").replace(/\n+\s*$/, "") + "\n"
}

function sanitize(s: string) {
  return s.replace(/\r\n/g, "\n").trim()
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return h.toString(36)
}

// Fallback extraction: look for small code-like blocks starting with "public class" lines
function extractInlineJava(notes: string): JavaExample[] {
  const lines = notes.split(/\r?\n/)
  const res: JavaExample[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(public\s+class|class)\s+\w+/.test(lines[i])) {
      let j = i
      let snippet = ""
      let braceBalance = 0
      let started = false

      while (j < lines.length) {
        const line = lines[j]
        snippet += line + "\n"
        // Count braces to detect block end
        for (const ch of line) {
          if (ch === "{") {
            braceBalance++
            started = true
          } else if (ch === "}") {
            braceBalance--
          }
        }
        if (started && braceBalance <= 0) break
        j++
      }

      const classNameMatch = snippet.match(/(public\s+class|class)\s+([A-Za-z_$][\w$]*)/)
      const className = classNameMatch ? classNameMatch[2] : "Sample"
      // Scan forward for output
      const outputLines = []
      for (let k = j + 1; k < Math.min(lines.length, j + 30); k++) {
        if (/^\s*(Out\s*put|Ouput|Output)\s*:/.test(lines[k])) {
          // collect until blank line
          for (let m = k + 1; m < Math.min(lines.length, k + 30); m++) {
            if (/^\s*$/.test(lines[m])) break
            outputLines.push(lines[m])
          }
          break
        }
      }

      res.push({
        title: `Example - ${className}.java`,
        filename: `${className}.java`,
        code: cleanupIndentation(snippet),
        output: outputLines.join("\n").trim() || undefined,
      })

      i = j
    }
  }
  return res
}
