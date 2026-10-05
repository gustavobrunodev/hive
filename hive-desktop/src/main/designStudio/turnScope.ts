import { isAbsolute, resolve, sep } from 'path'
import type { TurnScope } from '../agentAdapter'

/**
 * Design Studio — what a scoped turn may do (decision 2, Landing 13).
 *
 * A module turn runs in a Produto's folder and answers every permission
 * question the agent raises without a card: the module's public never sees a
 * tool, a path or a prompt (PRODUCT.md, "Esconder a máquina"). This is the one
 * function that answers. Both adapters ask it — Claude through the approval
 * endpoint, Devin through its ACP handlers — so "what the module may touch" is
 * one rule, written once.
 *
 * Pure on purpose: no disk, no process. A path is judged by where it resolves,
 * and a command by what it says, so the rule can be tested line by line.
 */

/** One permission question, in the agent-agnostic words the rule speaks. */
export type ScopedRequest =
  | { kind: 'read'; path: string }
  | { kind: 'write'; path: string }
  | { kind: 'command'; command: string }
  | { kind: 'other'; tool: string }

export type ScopedDecision = 'allow' | 'deny'

/**
 * A path as the platform's filesystem compares it: both separators read as
 * one *before* resolving — so `relatorios\..\..\x` cannot hide its `..` from
 * the resolver — then resolved against `cwd`, and case-folded on Windows.
 */
function normalize(path: string, cwd: string, platform: NodeJS.Platform): string {
  const unified = path.replace(/[\\/]+/g, sep)
  const full = isAbsolute(unified) ? resolve(unified) : resolve(cwd, unified)
  return platform === 'win32' ? full.toLowerCase() : full
}

/** `target` (relative paths against `cwd`) is `root` or somewhere under it. */
export function isWithin(
  root: string,
  target: string,
  cwd: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const base = normalize(root, cwd, platform)
  const full = normalize(target, cwd, platform)
  if (full === base) return true
  const prefix = base.endsWith(sep) ? base : base + sep
  return full.startsWith(prefix)
}

function withinAny(
  roots: readonly string[],
  target: string,
  cwd: string,
  platform: NodeJS.Platform
): boolean {
  return target !== '' && roots.some((root) => isWithin(root, target, cwd, platform))
}

/** Characters that make a command line more than one simple command. */
const OPERATORS = new Set([';', '&', '|', '<', '>', '(', ')', '`', '$', '\n', '\r'])

/** The words read so far, the one being read, and the quote it is inside. */
interface Reading {
  words: string[]
  word: string
  started: boolean
  quote: "'" | '"' | null
}

/**
 * Reads one character, answering how many characters it consumed (an escape
 * takes two) — or `null` when the line stops being one simple command.
 */
function readChar(state: Reading, command: string, index: number, posix: boolean): number | null {
  const char = command[index]
  const next = command[index + 1] ?? ''
  if (state.quote === "'") {
    if (char === "'") state.quote = null
    else state.word += char
    return 1
  }
  if (state.quote === '"') return readQuoted(state, char, next, posix)
  if (char === "'" || char === '"') {
    state.quote = char
    state.started = true
    return 1
  }
  if (OPERATORS.has(char)) return null
  if (char === ' ' || char === '\t') {
    if (state.started) state.words.push(state.word)
    state.word = ''
    state.started = false
    return 1
  }
  state.started = true
  if (char === '\\' && posix && next !== '') {
    state.word += next
    return 2
  }
  state.word += char
  return 1
}

/** One character inside double quotes: `$` and backtick still expand there. */
function readQuoted(state: Reading, char: string, next: string, posix: boolean): number | null {
  if (char === '"') {
    state.quote = null
    return 1
  }
  if (char === '$' || char === '`') return null
  if (char === '\\' && posix && (next === '"' || next === '\\')) {
    state.word += next
    return 2
  }
  state.word += char
  return 1
}

/**
 * Splits a command line into words the way a POSIX shell would, or answers
 * `null` when it is not one simple command: an operator, a redirection, a
 * substitution (`$`, backtick) or a line break anywhere outside single quotes.
 *
 * Backslash is an escape only on POSIX. On Windows it is the path separator
 * an agent writes in `C:\Users\…`, and reading it as an escape would turn a
 * legitimate script path into a different one.
 */
export function splitCommand(
  command: string,
  platform: NodeJS.Platform = process.platform
): string[] | null {
  const state: Reading = { words: [], word: '', started: false, quote: null }
  const posix = platform !== 'win32'
  for (let index = 0; index < command.length;) {
    const consumed = readChar(state, command, index, posix)
    if (consumed === null) return null
    index += consumed
  }
  if (state.quote !== null) return null
  if (state.started) state.words.push(state.word)
  return state.words
}

/** The executable's name without a Windows `.exe`, compared case-insensitively there. */
function program(word: string, platform: NodeJS.Platform): string {
  const name = word.replace(/\.exe$/i, '')
  return platform === 'win32' ? name.toLowerCase() : name
}

/**
 * Whether `command` is one of the scope's closed list (Unresolved 4: `node`
 * running the Fonte skill's own script). An entry is `node <script>`; the
 * request matches when it is a single simple command whose program is the
 * entry's and whose first argument resolves to the entry's script.
 */
export function isListedCommand(
  scope: TurnScope,
  command: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const words = splitCommand(command.trim(), platform)
  if (!words || words.length < 2) return false
  return scope.commands.some((entry) => {
    const allowed = splitCommand(entry, platform)
    if (!allowed || allowed.length < 2) return false
    if (program(words[0], platform) !== program(allowed[0], platform)) return false
    return normalize(words[1], scope.cwd, platform) === normalize(allowed[1], scope.cwd, platform)
  })
}

/**
 * The answer to one permission question of a scoped turn (Landing 2 and 13):
 *
 *   - a read inside `readRoots` is allowed, anywhere else denied — decision 2
 *     confines reading to the turn, not only writing;
 *   - a write inside `writeRoots` is allowed, anywhere else denied, `..` and
 *     relative paths included (they are judged where they land);
 *   - a command on the closed list is allowed, every other command denied;
 *   - any other tool is denied.
 */
export function decideScoped(
  scope: TurnScope,
  request: ScopedRequest,
  platform: NodeJS.Platform = process.platform
): ScopedDecision {
  switch (request.kind) {
    case 'read':
      return withinAny(scope.readRoots, request.path, scope.cwd, platform) ? 'allow' : 'deny'
    case 'write':
      return withinAny(scope.writeRoots, request.path, scope.cwd, platform) ? 'allow' : 'deny'
    case 'command':
      return isListedCommand(scope, request.command, platform) ? 'allow' : 'deny'
    case 'other':
      return 'deny'
  }
}
