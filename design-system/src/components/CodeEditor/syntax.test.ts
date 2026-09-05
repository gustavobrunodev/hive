import { describe, expect, it } from "vitest"
import {
  CSV_COLUMN_ROLES,
  HIGHLIGHT_CEILING,
  detectDelimiter,
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
  csv: 'nome,papel,nota\n"Curie, Marie",física,10\nAda,engenheira,9\n',
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

describe("delimited data (csv)", () => {
  it("colours by column, not by syntax, cycling after six", () => {
    const runs = highlight("a,b,c,d,e,f,g\n", "csv")
    const fields = runs.filter((run) => run.text !== ",")
    expect(fields.slice(0, 6).map((run) => run.role)).toEqual([...CSV_COLUMN_ROLES])
    // The seventh column starts the ramp over.
    expect(fields[6]?.role).toBe(CSV_COLUMN_ROLES[0])
  })

  it("restarts the ramp on every row, and keeps the delimiters as punctuation", () => {
    const runs = highlight("a,b\nc,d\n", "csv")
    expect(runs.filter((run) => run.text === ",").every((run) => run.role === "punctuation")).toBe(true)
    const firstOfEachRow = runs.filter((run) => run.text === "a" || run.text === "c")
    expect(firstOfEachRow.map((run) => run.role)).toEqual([CSV_COLUMN_ROLES[0], CSV_COLUMN_ROLES[0]])
  })

  it("does not count a delimiter inside quotes as a column break", () => {
    const runs = highlight('"Curie, Marie",física\n', "csv")
    expect(runs[0]).toEqual({ text: '"Curie, Marie"', role: CSV_COLUMN_ROLES[0] })
    expect(runs[1]).toEqual({ text: ",", role: "punctuation" })
    expect(runs[2]).toEqual({ text: "física", role: CSV_COLUMN_ROLES[1] })
  })

  it("detects the delimiter over several lines, ignoring quoted text", () => {
    expect(detectDelimiter("a,b\nc,d\n")).toBe(",")
    expect(detectDelimiter("a;b;c\n1;2;3\n")).toBe(";")
    expect(detectDelimiter("a\tb\n1\t2\n")).toBe("\t")
    expect(detectDelimiter("a|b\n1|2\n")).toBe("|")
    // A header of one word per column decides nothing; the rows do.
    expect(detectDelimiter('nome\n"a, b";x\n"c, d";y\n')).toBe(";")
    // Nothing recognisable is a single-column file, not a guess.
    expect(detectDelimiter("uma coluna só\noutra linha\n")).toBe(",")
  })

  it("reads .csv and .tsv off the name", () => {
    expect(languageFor("data/vendas.csv")).toBe("csv")
    expect(languageFor("data/vendas.TSV")).toBe("csv")
  })
})
