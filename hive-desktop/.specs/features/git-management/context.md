# Git Management — Context

**Gathered:** 2026-07-23
**Spec:** `.specs/features/git-management/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Complete, in-app git version control for the active workspace — VS Code/Cursor
parity: a switchable Source Control sidebar view, change review with staging,
inline commit, diff viewer, branches, remote sync, commit history, merge
conflict resolution, stash, explorer decorations, editor gutter marks, and a
status bar. Remotes use the **system** credential setup only. Out-of-scope
capabilities are listed in `spec.md` (no in-app tokens, no per-hunk staging in
P1, no blame/graph/PR integration).

---

## Implementation Decisions (locked)

These came from the user directly (`AskUserQuestion`, 2026-07-23) and are fixed
inputs to design — not to be re-litigated.

### D-GIT-1 — Remote operations & authentication: **system credentials only**

- push / pull / fetch / sync run through the machine's git (credential helper,
  SSH keys, cached credentials). Hive **never** prompts for or stores a
  password/token, and builds no credential UI.
- On an auth failure, surface git's **real** stderr, i18n-wrapped, with a short
  "configure suas credenciais no git/SSH" hint. No silent failure.
- Consequence for design: no `safeStorage`, no secret persistence, no keyring
  code. The `GitService` just runs git and reports what git says.

### D-GIT-2 — Layout: **switchable sidebar (VS Code/Cursor style)**

- The left rail becomes a **multi-view sidebar**. The `ActionRail` gains an
  Explorer entry and a Source Control entry; selecting one swaps the sidebar
  pane's content (one view at a time), exactly like VS Code's activity bar.
- The Source Control rail entry carries a **change-count badge**.
- Pane widths and the movable-pane order (`hive.workLayout` / `hive.paneOrder`)
  must survive the view switch — the rail pane keeps its identity; only its
  body swaps.
- `Ctrl/Cmd+Shift+G` opens the Source Control view (VS Code parity); the
  existing `Ctrl/Cmd+P` (file search) stays.

### D-GIT-3 — P1 scope: **the full selected set**

- P1 includes **all four** advanced buckets the user chose: commit **history**
  (timeline + per-file), merge **conflict resolution**, **stash**, and
  **decorations + editor gutter** — on top of the core loop (status, stage/
  unstage, commit, discard, branches, diff viewer, remote sync, repo init).
- Deferred to P2/P3 (see `spec.md` Out of Scope): per-hunk staging, gutter
  hunk peek/revert, revert-commit/cherry-pick, tags, branch compare/graph,
  blame, provider/PR integration.

---

## Agent's Discretion

The user said "ME SURPREENDA" and gave explicit latitude to create/extend
design-system components where the experience wins. These are mine to decide in
`design.md` (documented there, open to correction at design review):

- **Git engine mechanism** — the git **CLI** driven through the existing
  `processRunner.ts` (the codebase's established CLI pattern; `git` binary is
  present at 2.34.1), **not** a new heavy dependency (`simple-git`/
  `isomorphic-git`/`nodegit`). Rationale + porcelain choices belong in design.
- **New components** — a `DiffView` (unified + side-by-side, gutter-aware) and a
  `StatusBar`, plus a conflict-merge surface, live where they earn reuse:
  design decides DS-package vs app-local. Change decorations extend the DS
  `Tree`; history reuses the DS `Timeline`; branch/quick-pick reuses `Command`.
- **Exact visual language** of decorations, diff coloring, glyphs, and status
  bar — shaped with `impeccable` (product register) on DS role tokens, both
  themes for free. Git-status color is treated as **semantic state**, not
  decoration.
- **Refresh strategy** — reuse `watchWorkspace` fs events + refresh-on-focus +
  refresh-after-own-ops (a targeted `git status` re-run), debounced. Design
  picks the exact debounce/coalescing.
- **Diff computation for the gutter** — design chooses (diff against HEAD via
  git vs `fast-diff` already in `node_modules`) and where it runs (main vs
  renderer worker) to keep typing smooth.
- **Empty/loading/error copy and states** for every surface — teaching empty
  states, skeletons not spinners, per product register.

---

## Specific References

- **VS Code / Cursor Source Control** is the explicit reference model: activity-
  bar view switch, grouped change list (Merge/Staged/Changes), hover row
  actions + group actions, inline multi-line commit box (no modal), status-bar
  branch pill with ↑↓ sync, quick-pick branch switcher, "file (Working Tree)"
  diff tabs, inline 3-way conflict controls, Timeline history.
- **Claude Desktop** referenced for calm, first-party chrome (quiet until
  needed) — reinforces the app's own PRODUCT.md ("the tool should disappear
  into the task", anti-reference: "wrapped terminal / log-dump UIs").
- Reuse existing app muscle memory already built: the three-way unsaved-changes
  guard dialog (branch switch / stash reuse it), `Command` quick-pick (branch
  picker), `ContextMenu` (row/file right-click), `Toast` (op results),
  `Resizable` panes (unchanged), `EditorTabs` (diff opens as a tab).

---

## Deferred Ideas

Captured so they're not lost; explicitly **out of this feature**.

- Per-hunk / per-line staging & discard, and inline gutter hunk peek/revert
  (P2 — GIT-P2 in ROADMAP).
- Revert-commit / cherry-pick from the history timeline (P2).
- Tags (create/list/push) (P2).
- Branch compare + commit-graph visualization (P3).
- Git blame / inline authorship (P3).
- GitHub/GitLab PR + issue integration — a provider feature with its own auth
  (separate from local git; would revisit D-GIT-1's "no in-app auth" boundary).
- Multi-root / multiple repositories in one window.
