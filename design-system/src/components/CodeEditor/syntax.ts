/* eslint-disable import/no-unassigned-import */
// Prism, wired the way bundlers are meant to wire it: the *core* entry (which
// never scans the document or auto-highlights anything), then one explicit
// grammar per language we actually ship. The order matters — every grammar
// file assigns into the `Prism` global that core installs — so these imports
// are a sequence, not a set, and must not be sorted.
import Prism from "prismjs/components/prism-core"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-markup"
import "prismjs/components/prism-css"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-tsx"
import "prismjs/components/prism-json"
import "prismjs/components/prism-yaml"
import "prismjs/components/prism-markdown"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-python"
import "prismjs/components/prism-toml"
import "prismjs/components/prism-ini"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-diff"

/** A grammar this editor can colour. `null` means "show it as plain text". */
export type CodeLanguage =
  | "markdown"
  | "markup"
  | "css"
  | "javascript"
  | "jsx"
  | "typescript"
  | "tsx"
  | "json"
  | "yaml"
  | "bash"
  | "python"
  | "toml"
  | "ini"
  | "sql"
  | "diff"
  /* Not a Prism grammar: delimited data is coloured by COLUMN, below. */
  | "csv"

const BY_EXTENSION: Record<string, CodeLanguage> = {
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  vue: "markup",
  css: "css",
  scss: "css",
  less: "css",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  json: "json",
  jsonc: "json",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  py: "python",
  toml: "toml",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  editorconfig: "ini",
  sql: "sql",
  diff: "diff",
  patch: "diff",
  csv: "csv",
  tsv: "csv",
}

/**
 * Filenames that carry their language in the *whole* name rather than in an
 * extension — the dotfiles and manifests a workspace is full of, which would
 * otherwise all fall through to plain text.
 */
const BY_NAME: Record<string, CodeLanguage> = {
  dockerfile: "bash",
  makefile: "bash",
  ".env": "bash",
  ".gitignore": "bash",
  ".npmrc": "ini",
  ".editorconfig": "ini",
}

/**
 * The grammar for a path, or `null` when we have none — in which case the
 * editor shows the file in plain ink rather than guessing. Guessing is the
 * worse failure: colour that means nothing is harder to read than no colour,
 * because the eye keeps trying to decode it.
 */
export function languageFor(path: string | undefined): CodeLanguage | null {
  if (!path) return null
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase()
  const byName = BY_NAME[name]
  if (byName) return byName
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return null
  const found = BY_EXTENSION[name.slice(dot + 1)]
  return found ?? null
}

/**
 * One highlighted run: the exact characters Prism was given, plus the role
 * that decides its colour (`null` for ordinary text).
 *
 * The editor paints these behind a real `<textarea>`, so the contract is
 * absolute: **concatenating every `text` must reproduce the source exactly.**
 * A single added or dropped character slides every colour after it off the
 * words it belongs to. `Prism.tokenize` guarantees this, and
 * `syntax.test.ts` re-checks it on every grammar we ship.
 */
export interface CodeRun {
  text: string
  role: CodeRole | null
}

/**
 * The colour vocabulary — deliberately eight roles and not Prism's ninety
 * token types. A palette a reader can learn is one where each colour means one
 * thing; mapping every grammar onto the same eight is what makes TypeScript
 * and YAML feel like the same editor rather than two themes.
 */
export type CodeRole =
  | "comment"
  | "keyword"
  | "string"
  | "number"
  | "function"
  | "type"
  | "property"
  | "punctuation"
  /* Markdown carries emphasis, not just colour: these three are the reason the
     `.md` a BMAD workflow produces reads as a document while you edit it. */
  | "heading"
  | "emphasis"
  | "strong"
  | "link"

/** Prism token type (or alias) → colour role. First match wins. */
const ROLES: Record<string, CodeRole> = {
  comment: "comment",
  prolog: "comment",
  doctype: "comment",
  cdata: "comment",
  blockquote: "comment",
  hr: "comment",

  keyword: "keyword",
  atrule: "keyword",
  rule: "keyword",
  important: "keyword",
  "list-punctuation": "keyword",
  list: "keyword",
  boolean: "keyword",
  null: "keyword",
  selector: "keyword",
  command: "keyword",
  inserted: "keyword",

  string: "string",
  char: "string",
  "attr-value": "string",
  "code-snippet": "string",
  regex: "string",

  number: "number",
  constant: "number",
  symbol: "number",
  unit: "number",
  entity: "number",
  deleted: "number",

  function: "function",
  "function-variable": "function",
  builtin: "function",
  "class-name": "function",
  "maybe-class-name": "function",

  tag: "type",
  namespace: "type",
  variable: "type",
  parameter: "type",
  "table-header": "type",

  property: "property",
  "attr-name": "property",
  key: "property",
  "property-access": "property",

  punctuation: "punctuation",
  operator: "punctuation",
  "table-line": "punctuation",

  title: "heading",
  bold: "strong",
  italic: "emphasis",
  url: "link",
  "url-reference": "link",
  "url-link": "link",
}

function roleOf(type: string, alias: string | string[] | undefined): CodeRole | null {
  const direct = ROLES[type]
  if (direct) return direct
  const aliases = alias === undefined ? [] : Array.isArray(alias) ? alias : [alias]
  for (const name of aliases) {
    const found = ROLES[name]
    if (found) return found
  }
  return null
}

/**
 * Above this many characters the editor stops colouring and shows plain ink.
 *
 * Tokenizing runs on every keystroke, and a grammar walking a megabyte of text
 * between two frames is a keyboard that lags — which is a far worse editor than
 * a monochrome one. The ceiling is generous: every markdown artifact this app
 * produces, and every source file in its own repo, is an order of magnitude
 * under it.
 */
export const HIGHLIGHT_CEILING = 400_000

/**
 * The ink each column gets, in order, cycling after six.
 *
 * Delimited data has no keywords to colour and no strings to tell from
 * numbers — its ambiguity is entirely positional: which field am I looking
 * at, and does this row have the same number of them as the header. So the
 * colour stops meaning "this is a literal" and starts meaning "this is column
 * three", which is the question the reader actually has. The six are the
 * hue-carrying roles of the shared palette (blue, green, amber, violet, cyan,
 * red), so a CSV inherits the same measured contrast every other file gets,
 * in every theme, for free.
 *
 * `DataGrid.css` paints its column headers from the same six, in this order:
 * a column is one colour whether you are looking at the table or at the raw
 * text behind it.
 */
export const CSV_COLUMN_ROLES: readonly CodeRole[] = [
  "function",
  "string",
  "number",
  "property",
  "type",
  "keyword",
]

/** The delimiters we recognise, in the order a tie is broken. */
const CSV_DELIMITERS = [",", ";", "\t", "|"] as const

export type CsvDelimiter = (typeof CSV_DELIMITERS)[number]

/**
 * Which character separates the fields of `source`.
 *
 * Counted outside quotes, over the first few lines rather than only the
 * first: a header of one word per column is exactly the line that fails to
 * distinguish `;` from `,`, and prose fields full of commas inside quotes are
 * exactly what a naive count gets wrong. Exported because whoever *parses*
 * the file has to reach the same answer the colouring did — two disagreeing
 * delimiters is a mirror that paints columns the table does not have.
 */
export function detectDelimiter(source: string): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number>(CSV_DELIMITERS.map((d) => [d, 0]))
  let quoted = false
  let lines = 0
  for (let at = 0; at < source.length && lines < 5; at++) {
    const char = source[at] as string
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === "\n") {
      lines++
      continue
    }
    const delimiter = CSV_DELIMITERS.find((candidate) => candidate === char)
    if (delimiter) counts.set(delimiter, (counts.get(delimiter) as number) + 1)
  }
  let best: CsvDelimiter = ","
  for (const candidate of CSV_DELIMITERS) {
    if ((counts.get(candidate) as number) > (counts.get(best) as number)) best = candidate
  }
  return best
}

/**
 * Delimited text → runs coloured by column.
 *
 * A scanner rather than a grammar, because the thing being recognised is
 * position, not syntax: fields take their column's ink, the delimiters
 * themselves stay punctuation so the structure is visible without competing
 * with the data, and a quoted field keeps its quotes (they are part of what
 * is on disk, and hiding them would break the mirror's contract).
 */
function highlightDelimited(source: string): CodeRun[] {
  const delimiter = detectDelimiter(source)
  const runs: CodeRun[] = []
  let column = 0
  let quoted = false
  let start = 0
  const flush = (end: number, role: CodeRole | null): void => {
    if (end > start) push(runs, source.slice(start, end), role)
    start = end
  }
  for (let at = 0; at < source.length; at++) {
    const char = source[at] as string
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === delimiter) {
      flush(at, CSV_COLUMN_ROLES[column % CSV_COLUMN_ROLES.length] as CodeRole)
      flush(at + 1, "punctuation")
      column++
    } else if (char === "\n") {
      flush(at, CSV_COLUMN_ROLES[column % CSV_COLUMN_ROLES.length] as CodeRole)
      flush(at + 1, null)
      column = 0
    }
  }
  flush(source.length, CSV_COLUMN_ROLES[column % CSV_COLUMN_ROLES.length] as CodeRole)
  return runs
}

/**
 * Source → coloured runs. Falls back to a single uncoloured run whenever there
 * is no grammar, no language, or simply too much text.
 */
export function highlight(source: string, language: CodeLanguage | null): CodeRun[] {
  if (source.length > HIGHLIGHT_CEILING) return [{ text: source, role: null }]
  if (language === "csv") return highlightDelimited(source)
  const grammar = language === null ? undefined : Prism.languages[language]
  if (!grammar) return [{ text: source, role: null }]
  const runs: CodeRun[] = []
  collect(Prism.tokenize(source, grammar), null, runs)
  return runs
}

/**
 * Flattens Prism's nested token tree into a flat run list, keeping the
 * *innermost* role that has one — a `attr-value` inside a `tag` should read as
 * a string, not as a tag — and falling back to the enclosing role otherwise, so
 * a markdown heading's punctuation still reads as part of the heading.
 */
function collect(
  tokens: Array<string | Prism.Token>,
  inherited: CodeRole | null,
  out: CodeRun[]
): void {
  for (const token of tokens) {
    if (typeof token === "string") {
      push(out, token, inherited)
      continue
    }
    const role = roleOf(token.type, token.alias) ?? inherited
    if (typeof token.content === "string") {
      push(out, token.content, role)
    } else if (Array.isArray(token.content)) {
      collect(token.content as Array<string | Prism.Token>, role, out)
    } else {
      collect([token.content as Prism.Token], role, out)
    }
  }
}

/** Appends, merging into the previous run when the role is unchanged. */
function push(out: CodeRun[], text: string, role: CodeRole | null): void {
  if (text === "") return
  const last = out[out.length - 1]
  if (last && last.role === role) last.text += text
  else out.push({ text, role })
}

/**
 * The same runs, cut at every newline: one array per source line, and no run's
 * `text` containing a `\n`.
 *
 * The editor draws one block element per source line — that is what lets a
 * line number, a change bar and the current-line wash line up with a line that
 * wrapped into three rows, which a flat stream of coloured runs cannot do. The
 * newline itself is dropped, because the block boundary *is* the break: a
 * literal `\n` left inside a `white-space: pre-wrap` block would open a second,
 * empty row and every line below would sit one row too low.
 *
 * The mirror's contract survives the cut, restated per line: joining every
 * run's text within a line, and the lines with `\n`, reproduces the source
 * exactly. `syntax.test.ts` holds all fifteen grammars to it.
 */
export function highlightLines(source: string, language: CodeLanguage | null): CodeRun[][] {
  let current: CodeRun[] = []
  const lines: CodeRun[][] = [current]
  for (const run of highlight(source, language)) {
    const parts = run.text.split("\n")
    for (let index = 0; index < parts.length; index++) {
      if (index > 0) {
        current = []
        lines.push(current)
      }
      const text = parts[index] as string
      if (text !== "") current.push({ text, role: run.role })
    }
  }
  return lines
}
