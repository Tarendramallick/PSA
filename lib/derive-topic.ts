export type Topic =
  | "Basics"
  | "Variables"
  | "Control Flow"
  | "Loops"
  | "Arrays"
  | "Strings"
  | "Methods"
  | "Classes & Objects"
  | "Constructors"
  | "Inheritance"
  | "Polymorphism"
  | "Interfaces"
  | "Abstract Classes"
  | "Exceptions"
  | "Collections"
  | "Generics"
  | "File I/O"
  | "Threads"
  | "Math & Utils"
  | "Other"

type Example = { title?: string; filename?: string; code: string }

export function deriveTopic(example: Example): Topic {
  const t = `${example.title || ""} ${example.filename || ""}`.toLowerCase()
  const c = (example.code || "").toLowerCase()

  const has = (re: RegExp) => re.test(c) || re.test(t)

  if (has(/\b(array|int\[\]|new\s+int\[\])/)) return "Arrays"
  if (has(/\b(string|char\[\]|substring|equals|compareto|builder|buffer)/)) return "Strings"
  if (has(/\b(for\s*\(|while\s*\(|do\s*\{)/)) return "Loops"
  if (has(/\b(if\s*\(|switch\s*\()|case\s+|default\s*:/)) return "Control Flow"
  if (has(/\b(public|private|protected)\s+class\b/)) return "Classes & Objects"
  if (has(/\bconstructor|this\s*\(|super\s*\(/)) return "Constructors"
  if (has(/\bextends\b/)) return "Inheritance"
  if (has(/\boverride|@override|dynamic\s+dispatch|polymorphism/)) return "Polymorphism"
  if (has(/\binterface\b/)) return "Interfaces"
  if (has(/\babstract\s+class\b/)) return "Abstract Classes"
  if (has(/\btry\s*\{|catch\s*\(|finally\b|throw\s+new\b|exception/)) return "Exceptions"
  if (has(/\b(list|arraylist|map|hashmap|set|hashset|iterator|collections)\b/)) return "Collections"
  if (has(/\b<\s*[a-z_][\w]*\s*>\b/)) return "Generics"
  if (has(/\bfile|filereader|filewriter|buffered(reader|writer)|scanner\b/)) return "File I/O"
  if (has(/\bthread|runnable|synchronized|wait\(|notify\(|notifyall\(/)) return "Threads"
  if (has(/\b(math|random|scanner)\b/)) return "Math & Utils"
  if (has(/\b(int|double|float|boolean|char|long|short|byte)\b/)) return "Variables"
  if (has(/\bmethod|void\s+[a-z_]\w*\(|return\b/)) return "Methods"

  return "Basics"
}
