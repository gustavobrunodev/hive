# Agent Change Review — Context

**Gathered:** 2026-07-24
**Spec:** `.specs/features/agent-change-review/spec.md`
**Status:** Ready for design

---

## Feature Boundary

An in-app review flow for the changes the agent makes to workspace files —
Cursor/Claude Desktop parity. The agent writes to disk (optimistic model); the
app captures a pre-turn checkpoint, surfaces the resulting changes as a single
reviewable pending set across four synchronized surfaces (inline editor diff,
in-chat change card, a persistent review bar, a switchable "Revisão do agente"
sidebar view), and lets the user accept (keep) or reject (revert) at hunk, file,
and set granularity. Diffs reuse `DiffView`/`gitParse`; capture reuses the FS
watcher; guards reuse the M4 STALE + M8 unsaved-guard conventions. Out-of-scope
items (pre-approval gate, multi-turn undo stack, semantic diffs, auto-commit)
are in `spec.md`.

---

## Implementation Decisions (locked)

These came from the user directly (`AskUserQuestion`, 2026-07-24) and are fixed
inputs to design — not to be re-litigated.

### ACR-C1 — Apply model: **optimistic (apply + revert)**

The agent keeps writing to disk during its turn (`--permission-mode acceptEdits`
is unchanged). Review means **keep or revert** against a pre-turn checkpoint —
the Cursor "checkpoint" mental model — not gate-before-write.

- **Why:** robust with the real CLI (no fighting `acceptEdits`), lets the agent
  read back / test its own output mid-turn, lowest risk.
- **Consequence:** "reject" = restore the pre-turn bytes (revert), so the
  **checkpoint is load-bearing** and must be race-free and always recoverable
  until the user explicitly accepts (drives G4, ACR-R1.1, ACR-R4.2).
- **Rejected alternative:** a **gated/pre-approval** model (hold writes via a
  Claude Code `PreToolUse` hook until approved). Truer to Cursor's "pending"
  state (nothing touches disk unapproved) but changes the execution model,
  fights `acceptEdits`, and is Claude-hook-specific. Deferred (spec Out of Scope).

### ACR-C2 — Capture mechanism: **app-managed snapshots, git-independent**

The app owns its own snapshots of the touched/pre-turn state and diffs against
them; it does **not** depend on the workspace being a git repo and does **not**
touch the user's `.git`.

- **Concrete realization (design's call, honoring the intent):** a **shadow
  checkpoint store** — a private git object store the app manages under
  `userData` (its own `GIT_DIR`, the workspace as `GIT_WORK_TREE`), used purely
  as a fast, race-free, content-addressed snapshot + diff engine. This is how
  Cursor's checkpoints work under the hood; it reuses git's incremental hashing
  and `gitParse` for diffs, while being invisible to and independent of any user
  git. A heavy-dir exclude (`node_modules`, `.git`, build output) keeps snapshots
  cheap. (git is already a hard dependency from M10.)
- **Why this over the literal per-file `git diff --no-index`:** capturing a
  file's *pre-image* requires knowing its content **before** the agent's write.
  Lazy per-file snapshotting on the FS-watcher event is inherently racy (the
  event arrives *after* the write). A turn-start whole-tree baseline is the only
  race-free, adapter-agnostic source of pre-images — and a shadow git makes that
  baseline incremental/cheap and gives us diff + revert (`checkout`/`apply -R`)
  for free. `git diff --no-index` is still available as the per-hunk apply/rebase
  primitive where a two-file compare is simpler.
- **Why not the user's git working tree (rejected primary):** would require the
  workspace be a repo and would **conflate** the user's own uncommitted edits
  with the agent's, with no attribution. The shadow store cleanly separates
  "pre-turn" from "now."
- **Scope:** adapter-agnostic — works for any adapter that writes to disk
  (Claude/Devin/Copilot), because it observes the filesystem, not the agent.

### ACR-C3 — Review surface: **tiered (editor + chat + bar + panel)**

The review lives in four synchronized surfaces over one pending set:

1. **Inline editor diff** (Cursor tier) — per-hunk ✓/✗ in the open file, reusing
   the M10 gutter infra.
2. **In-chat change card** (Claude Desktop tier) — a diff summary card per turn.
3. **Persistent review bar** — ambient "N pendentes" + accept/reject-all.
4. **"Revisão do agente" sidebar view** — the dedicated grouped list (sibling of
   the M10 Source Control view, via the existing `SidebarHost` switcher).

- **Why:** combines the two reference experiences; meets the user in-file, in-
  conversation, and in a dedicated home. One store feeds all (ACR-R2.5).

---

## Derived Decisions (design's, consistent with the locked three)

These are not separate user inputs; they're the design resolving the natural
follow-on questions the way the locked decisions and the Cursor/Claude Desktop
reference imply. Recorded here so they aren't re-litigated downstream.

### ACR-C4 — Granularity: **hunk + file + set** (per-hunk is a P1/P2 goal)

Cursor-grade per-hunk accept/reject is the target ("surprise me" + G3). File- and
set-level are the always-present bulk actions. Per-hunk revert = reverse-apply
that hunk's patch (`git apply -R`), rebuilt from the parsed `GitDiffHunk`; the
set re-diffs afterward. Whole-file/whole-set land in the first vertical slice;
per-hunk apply is its own task so its patch-math is isolated and well-tested.

### ACR-C5 — Change-set lifecycle: **one live pending set, accumulating**

There is exactly one pending set per workspace. It **accumulates** across turns
(a two-turn sequence the user hasn't reviewed shows both turns' net changes) and
is defined as "current work-tree vs. the last accepted/clean baseline." Accepting
advances the baseline for those paths; rejecting restores them. This matches
Cursor (changes pile up until you act) and avoids a brittle per-turn identity.
The chat **card** is still per-turn (it annotates the message), but it reads from
and writes to the same single set. A multi-turn undo *stack* is out (spec).

### ACR-C6 — UI shaped by `impeccable` + validated in Playwright MCP

Per D3 (mandatory) and the user's explicit instruction. All new chrome uses the
DS role tokens + `workbench.css` conventions in the product register; new
components extend the DS where the experience needs it (the user authorized
creating/extending DS components — experience over technical limits). Every
state is validated in the Playwright MCP (dark+light) via the static-build +
`window.hive`-mock recipe (STATE: hive-desktop-visual-validation). `impeccable`'s
`context.mjs` reports NO_PRODUCT_MD at the hive-desktop root, so we follow the
established identity-preservation path (DS committed tokens + product register)
as M16/M19/M20 did.

### ACR-C7 — Attribution is best-effort enrichment, not the capture basis

Capture is snapshot-based (ACR-C2), so it never depends on parsing the agent
stream. Where the Claude adapter's stream-json exposes `tool_use` blocks
(Write/Edit/MultiEdit + `file_path`), we may *label* changes with the tool/skill
that made them (ACR-R3.3) — but this is additive polish (P2) layered on top of
the adapter-agnostic snapshot set, and its absence changes nothing functional.

---

## Constraints & Reuse (from the codebase)

- **Reuse `DiffView`** (`ui/DiffView.tsx`) — unified/split, binary/large states,
  `actions` slot. Extend it (or wrap it) for **per-hunk** action controls.
- **Reuse `gitParse`/`gitStatus`** — `GitDiff`/`GitDiffHunk`/`GitDiffLine`,
  `toSplitRows`. The shadow store's `git diff` output parses through the same
  path.
- **Reuse the FS watcher** — `fsService.watchWorkspace` already fires on agent
  writes; it becomes the "recompute the pending set" trigger (debounced).
- **Reuse the editor gutter** — `scm/gutter.ts` + `scm/useGutter.ts` (M10 live
  change gutter) as the inline-diff anchor substrate.
- **Reuse the sidebar switcher** — `ui/SidebarHost.tsx` already flips
  Explorer⇄Source Control; add a third "Revisão do agente" view.
- **Reuse guards** — M4 `ConflictError('STALE')` (mtime baseline) for concurrent
  edits; M8 unsaved-guard dialog for workspace-switch teardown.
- **Turn lifecycle hook point** — `AgentService`/`Chat` session-effect is where
  turn start/end is observable; the checkpoint is taken on turn start, the set
  recomputed on watcher events + finalized on `done`/`interrupted`/`error`.
- **git is a hard dependency** (M10 `gitService` via `processRunner`) — the
  shadow store runs the same `git` through the same `ProcessRunner` DI, keeping
  everything unit-testable against a fake runner + a throwaway temp dir.

---

## Open Questions (resolve during design, none blocking)

- **OQ1 — Shadow store location & keying.** `userData/checkpoints/<hash(ws)>/` —
  confirm collision-free keying and cleanup on workspace removal.
- **OQ2 — Exclude set.** Baseline exclude (`node_modules`, `.git`, `dist`, `out`,
  build caches) vs. honoring the workspace `.gitignore` — design picks the exact
  `info/exclude` contents to keep snapshots cheap without hiding reviewable
  artifacts (BMAD `_bmad-output`, docs must remain visible).
- **OQ3 — Live vs. on-done capture.** Whether the inline/card surfaces update
  live as files stream in (debounced watcher recompute) or only at turn end —
  lean live, but design fixes the debounce + finalization contract.
- **OQ4 — Undo-accept window.** Duration/mechanics of ACR-R4.2's "desfazer"
  before a baseline advance is finalized (or make accept immediately final and
  drop R4.2 to P3) — design decides.
