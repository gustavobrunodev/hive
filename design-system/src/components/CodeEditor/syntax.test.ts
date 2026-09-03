import { describe, expect, it } from "vitest"
import {
  HIGHLIGHT_CEILING,
  highlight,
  highlightLines,
  languageFor,
  type CodeLanguage,
} from "./syntax"

const SAMPLES: Record<CodeLanguage, string> = {
  markdown: "# Título\n\nUm **parágrafo** com `código`, [um link](https://x.dev) e:\n\n- item\n",
  markup: '<section class="a">\n  <p>Olá &amp; tchau</p>\n</section>\n',
  css: ".a {\n  color: var(--ink); /* nota */\n  margin: 0 auto;\n}\n",
  javascript: "// nota\nconst a = { b: 1 }\nexport function f(x) {\n  return `${x}!`\n}\n",
  jsx: "const El = () => <div className=\"a\">{value}</div>\n",
  typescript: "interface A { b: string }\nconst c: A = { b: 'x' } // nota\n",
  tsx: "export const E = (): JSX.Element => <p title='a'>{1}</p>\n",
  json: '{\n  "a": [1, true, null],\n  "b": "texto"\n}\n',
  yaml: "# nota\na:\n  - b: 1\n    c: 'texto'\n",
  bash: "#!/bin/bash\nset -e\necho \"olá $USER\" | grep -q x\n",
  python: "# nota\ndef f(x: int) -> str:\n    return f'{x}'\n",
  toml: '[a]\nb = "texto"\nc = 12\n',
  ini: "; nota\n[a]\nb = texto\n",
  sql: "-- nota\nSELECT a, b FROM t WHERE c = 'x';\n",
  diff: "@@ -1 +1 @@\n-antes\n+depois\n",
}

describe("languageFor", () => {
  it("reads the grammar off the extension, case and path notwithstanding", () => {
    expect(languageFor("docs/PRD.MD")).toBe("markdown")
    expect(languageFor("/ws/src/main/index.ts")).toBe("typescript")
    expect(languageFor("a/b/c.yml")).toBe("yaml")
  })

  it("knows the files whose whole name is the type", () => {
    expect(languageFor("ws/Dockerfile")).toBe("bash")
    expect(languageFor("ws/.env")).toBe("bash")
  })

  it("returns null rather than guessing", () => {
    expect(languageFor("ws/notas")).toBeNull()
    expect(languageFor("ws/thing.wat")).toBeNull()
    expect(languageFor(undefined)).toBeNull()
  })
})

describe("highlight", () => {
  /**
   * The contract the whole mirror rests on. The editor paints these runs
   * *behind* a real textarea and aligns them by position alone, so a grammar
   * that adds, drops or reorders one character does not produce a small visual
   * bug — it slides every colour after it onto the wrong words. Every grammar
   * we ship is held to it here rather than trusted.
   */
  it.each(Object.keys(SAMPLES) as CodeLanguage[])(
    "reproduces %s source character for character",
    (language) => {
      const source = SAMPLES[language]
      const runs = highlight(source, language)
      expect(runs.map((run) => run.text).join("")).toBe(source)
    }
  )

  it.each(Object.keys(SAMPLES) as CodeLanguage[])("actually colours %s", (language) => {
    const runs = highlight(SAMPLES[language], language)
    expect(runs.some((run) => run.role !== null)).toBe(true)
  })

  it("leaves text alone when there is no grammar", () => {
    const runs = highlight("qualquer coisa", null)
    expect(runs).toEqual([{ text: "qualquer coisa", role: null }])
  })

  it("stops colouring past the ceiling instead of blocking the keystroke", () => {
    const huge = "const a = 1\n".repeat(Math.ceil(HIGHLIGHT_CEILING / 12) + 1)
    const runs = highlight(huge, "typescript")
    expect(runs).toEqual([{ text: huge, role: null }])
  })

  it("gives markdown its document roles, not just code ones", () => {
    const roles = new Set(highlight(SAMPLES.markdown, "markdown").map((run) => run.role))
    expect(roles.has("heading")).toBe(true)
    expect(roles.has("strong")).toBe(true)
    expect(roles.has("link")).toBe(true)
  })

  it("reads a YAML key as a property and its value as a string", () => {
    const runs = highlight("nome: 'hive'\n", "yaml")
    expect(runs.find((run) => run.text.includes("nome"))?.role).toBe("property")
    expect(runs.find((run) => run.text.includes("hive"))?.role).toBe("string")
  })
})

describe("highlightLines", () => {
  /**
   * The same contract as `highlight`, restated for the shape the editor
   * actually draws. The cut is where a mirror built out of per-line blocks can
   * silently go wrong — a dropped empty line, or a `\n` left inside a run —
   * and both failures look like text until you notice the numbers beside it
   * are one off.
   */
  it.each(Object.keys(SAMPLES) as CodeLanguage[])(
    "cuts %s into lines that rebuild the source exactly",
    (language) => {
      const source = SAMPLES[language]
      const lines = highlightLines(source, language)
      expect(lines.map((runs) => runs.map((run) => run.text).join("")).join("\n")).toBe(source)
      expect(lines.every((runs) => runs.every((run) => !run.text.includes("\n")))).toBe(true)
    }
  )

  it("keeps one entry per source line, blank ones included", () => {
    expect(highlightLines("a\n\n\nb", null)).toHaveLength(4)
    // A file ending in a newline has a last, empty line — the row the caret
    // sits on after you press Enter at the end.
    expect(highlightLines("a\n", null)).toHaveLength(2)
    expect(highlightLines("", null)).toEqual([[]])
  })
})
