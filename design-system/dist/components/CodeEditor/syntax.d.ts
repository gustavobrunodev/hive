import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-diff";
/** A grammar this editor can colour. `null` means "show it as plain text". */
export type CodeLanguage = "markdown" | "markup" | "css" | "javascript" | "jsx" | "typescript" | "tsx" | "json" | "yaml" | "bash" | "python" | "toml" | "ini" | "sql" | "diff";
/**
 * The grammar for a path, or `null` when we have none — in which case the
 * editor shows the file in plain ink rather than guessing. Guessing is the
 * worse failure: colour that means nothing is harder to read than no colour,
 * because the eye keeps trying to decode it.
 */
export declare function languageFor(path: string | undefined): CodeLanguage | null;
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
    text: string;
    role: CodeRole | null;
}
/**
 * The colour vocabulary — deliberately eight roles and not Prism's ninety
 * token types. A palette a reader can learn is one where each colour means one
 * thing; mapping every grammar onto the same eight is what makes TypeScript
 * and YAML feel like the same editor rather than two themes.
 */
export type CodeRole = "comment" | "keyword" | "string" | "number" | "function" | "type" | "property" | "punctuation" | "heading" | "emphasis" | "strong" | "link";
/**
 * Above this many characters the editor stops colouring and shows plain ink.
 *
 * Tokenizing runs on every keystroke, and a grammar walking a megabyte of text
 * between two frames is a keyboard that lags — which is a far worse editor than
 * a monochrome one. The ceiling is generous: every markdown artifact this app
 * produces, and every source file in its own repo, is an order of magnitude
 * under it.
 */
export declare const HIGHLIGHT_CEILING = 400000;
/**
 * Source → coloured runs. Falls back to a single uncoloured run whenever there
 * is no grammar, no language, or simply too much text.
 */
export declare function highlight(source: string, language: CodeLanguage | null): CodeRun[];
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
export declare function highlightLines(source: string, language: CodeLanguage | null): CodeRun[][];
