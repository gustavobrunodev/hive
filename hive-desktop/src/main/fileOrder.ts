/**
 * How a file list is ordered, once, for the whole app.
 *
 * The explorer, the knowledge base and every other surface that lists a
 * directory have to agree — a tree that puts `AGENTS.md` between `assets/` and
 * `build/` in one panel and somewhere else in another is not two orderings, it
 * is one broken one. This module is that single answer, and the answer is VS
 * Code's, because the whole explorer is built on that muscle memory
 * (PRODUCT.md, "OS-grade file management").
 *
 * VS Code's default (`explorer.sortOrder: "default"`) is two rules:
 *
 * 1. **Folders before files.** Not a tie-break — a directory always precedes a
 *    file, whatever the names are. It is why `README.md` sits at the bottom of
 *    a repo root instead of in the middle of the folders.
 * 2. **Names compared naturally**, via `Intl.Collator` with `numeric: true`:
 *    `item2` before `item10`, accents where the locale puts them, case as a
 *    tertiary difference (so `AGENTS.md` sorts by `agents`, next to `api/`, not
 *    ahead of everything lowercase the way a raw code-unit sort would).
 *
 * Numeric collation has one trap, and VS Code documents it too: `foo1` and
 * `foo01` compare *equal* under it. Two entries that compare equal are ordered
 * by whatever the sort happens to do, which means the tree can reorder itself
 * between two walks of an unchanged directory. The shorter name wins the tie,
 * which is stable and matches VS Code's `compareAndDisambiguateByLength`.
 */

/**
 * One collator for the process. Building an `Intl.Collator` is expensive
 * (it resolves locale data) and a directory walk calls the comparator
 * O(n log n) times per directory — constructing it inside `compare` is the
 * difference between a walk that costs nothing and one that shows up in a
 * profile.
 *
 * `undefined` locale on purpose: the host's locale is the one the names should
 * be sorted for, and it is the same choice VS Code makes.
 */
const collator = new Intl.Collator(undefined, { numeric: true })

/**
 * Compares two entry names the way the explorer orders them — natural,
 * locale-aware, and stable when numeric collation calls two different names
 * equal.
 */
export function compareFileNames(one: string, other: string): number {
  const result = collator.compare(one, other)
  if (result !== 0) return result
  // `foo1` vs `foo01`: equal under numeric collation, different strings. The
  // shorter one goes first — any deterministic rule would do, but this is the
  // one VS Code uses, and matching it keeps the two trees identical.
  if (one.length !== other.length) return one.length < other.length ? -1 : 1
  return one < other ? -1 : one > other ? 1 : 0
}

/** The two kinds of entry an ordering has to separate, named so callers read as sentences. */
export interface OrderableEntry {
  name: string
  directory: boolean
}

/**
 * The explorer's row order: every directory, then every file, each group by
 * `compareFileNames`.
 */
export function compareEntries(one: OrderableEntry, other: OrderableEntry): number {
  if (one.directory !== other.directory) return one.directory ? -1 : 1
  return compareFileNames(one.name, other.name)
}
