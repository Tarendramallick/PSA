import { NextResponse } from "next/server"

const JUDGE0 = "https://ce.judge0.com/submissions?base64_encoded=true&wait=true"
const JAVA_LANGUAGE_ID = 62

function toLF(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function stripPackages(s: string) {
  return s.replace(/^\s*package\s+[\w.]+\s*;\s*/gm, "")
}

function normalizeJava(codeRaw: string) {
  // 1) Normalize newlines and strip package lines
  let code = stripPackages(toLF(codeRaw))

  const mainClassMatch = code.match(
    /(public\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)[\s\S]*?public\s+static\s+void\s+main\s*$$\s*String\[\]\s+\w+\s*$$/s,
  )

  if (mainClassMatch) {
    const className = mainClassMatch[2]

    code = code.replace(new RegExp(`\\bpublic\\s+class\\s+${className}\\b`, "g"), `class ${className}`)

    const wrapper = `
public class Main {
  public static void main(String[] args) {
    ${className}.main(args);
  }
}
`.trimStart()

    return `${code}\n\n${wrapper}\n`
  }

  // 3) If no class with main found but there's at least one class, just append a minimal Main that does nothing
  if (/class\s+[A-Za-z_$][A-Za-z0-9_$]*/.test(code)) {
    const wrapper = `
public class Main {
  public static void main(String[] args) {
    // No main detected in user/example code; nothing to run.
  }
}
`.trimStart()
    return `${code}\n\n${wrapper}\n`
  }

  // 4) If it's just statements, wrap them inside a Main class’ main method
  const wrappedStatements = `
public class Main {
  public static void main(String[] args) {
${toLF(code)
  .split("\n")
  .map((l) => "    " + l)
  .join("\n")}
  }
}
`.trimStart()
  return wrappedStatements + "\n"
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawCode: string = body?.code || ""
    const stdin: string = body?.stdin || ""

    if (!rawCode) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 })
    }

    const code = normalizeJava(rawCode)

    const payload = {
      language_id: JAVA_LANGUAGE_ID,
      source_code: Buffer.from(code).toString("base64"),
      stdin: Buffer.from(stdin).toString("base64"),
      compiler_options: null,
      command_line_arguments: null,
    }

    const r = await fetch(JUDGE0, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await r.json()

    const decode = (v?: string | null) => (v ? Buffer.from(v, "base64").toString("utf-8") : "")

    const stdout = decode(result?.stdout)
    const stderr = decode(result?.stderr)
    const compile_output = decode(result?.compile_output)
    const message = result?.message || ""
    const status = result?.status?.description || ""

    const combined = stdout?.trim() || compile_output?.trim() || stderr?.trim() || message?.trim() || ""

    return NextResponse.json({
      status,
      stdout,
      stderr,
      compile_output,
      message,
      combined,
      normalized: code,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Compilation failed" }, { status: 500 })
  }
}
