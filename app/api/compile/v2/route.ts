import { NextResponse } from "next/server"

type ExecResponse = {
  run?: { stdout?: string; stderr?: string }
  compile?: { stdout?: string; stderr?: string }
}

function normalizeJava(code: string) {
  // Normalize newlines and strip BOM
  let src = code
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\uFEFF/, "")

  // Remove package lines to avoid file path issues
  src = src.replace(/^\s*package\s+[^;]+;\s*/gm, "")

  // Demote any "public class X" to "class X" (we'll provide our own public Main)
  src = src.replace(/(^|\s)public\s+class\s+/g, "$1class ")

  // Try to detect a class name nearest to a main method
  // 1) Find first main occurrence
  const mainIdx = src.search(/\bstatic\s+void\s+main\s*$$\s*String\s*\[\]\s*\w*\s*$$/)
  let mainClass: string | null = null
  if (mainIdx !== -1) {
    // Scan backwards to locate the preceding "class <Name>"
    const before = src.substring(0, mainIdx)
    const matchAll = Array.from(before.matchAll(/class\s+([A-Za-z_]\w*)\s*\{/g))
    if (matchAll.length > 0) {
      mainClass = matchAll[matchAll.length - 1][1]
    }
  }

  // If there is already a public class Main with a main, we can just return as-is
  const hasPublicMainClass = /\bpublic\s+class\s+Main\b/.test(code) || /\bclass\s+Main\b/.test(src)
  const hasMainMethod = mainIdx !== -1

  if (hasPublicMainClass && hasMainMethod) {
    return src // already runnable as Main
  }

  // Append a Main launcher if we detected a main method in some class
  if (hasMainMethod) {
    const target = mainClass || "MainProgram"
    // If no explicit class name found before main, keep code intact and still add wrapper that calls Main.main
    const launcherTarget = mainClass ? target : "Main"
    const launcher = `
public class Main {
  public static void main(String[] args) {
    ${launcherTarget}.main(args);
  }
}
`.trim()

    // If no class named Main exists and we didn't find class for main (edge), keep original and still add Main wrapper.
    return src + "\n\n" + launcher + "\n"
  }

  // If no main found, just wrap the entire source in a minimal Main that prints nothing,
  // but still compiles. Alternatively, we can return as-is and let user see "No main" runtime.
  const fallback = `
public class Main {
  public static void main(String[] args) { }
}
`.trim()

  return src + "\n\n" + fallback + "\n"
}

export async function POST(req: Request) {
  try {
    const { code, language = "java", normalize = true } = await req.json()

    if (language !== "java") {
      return NextResponse.json({ ok: false, error: "Only Java is supported in v2." }, { status: 400 })
    }

    const content: string = typeof code === "string" ? code : ""
    const prepared = normalize ? normalizeJava(content) : content

    const res = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "java",
        version: "latest",
        files: [{ name: "Main.java", content: prepared }],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ ok: false, error: "Upstream error: " + text }, { status: 502 })
    }

    const data = (await res.json()) as ExecResponse
    const stdout = data.run?.stdout || ""
    const stderr = data.run?.stderr || ""
    const compileOut = data.compile?.stdout || data.compile?.stderr || ""

    const combined = [stdout, compileOut, stderr].filter(Boolean).join("\n").trim() || "No output"

    return NextResponse.json({
      ok: true,
      stdout,
      stderr,
      compile_output: compileOut,
      output: combined,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
