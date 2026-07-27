# Spec — Agent Change Review (Revisão de mudanças do agente, estilo Cursor/Claude Desktop)

**Feature dir:** `.specs/features/agent-change-review/`
**Milestone:** new **M11 — Agent Change Review** (ROADMAP.md).
**Scope:** Large/Complex (new main `CheckpointService` + `ReviewService` over an
app-managed shadow-git checkpoint store + IPC + preload bridge + turn-lifecycle
wiring into `AgentService`/`Chat` + a new tiered review surface in the renderer
— inline editor diff, in-chat change cards, a persistent review bar, and a
switchable "Revisão do agente" sidebar view — plus per-hunk accept/reject
extensions to `DiffView`).

---

## Problem Statement

When a Hive squad member asks the agent to do work, the agent (the real `claude`
CLI, run with `--permission-mode acceptEdits`) **writes files straight to disk**
mid-turn. The user finds out only obliquely — a file's content silently changed,
maybe an explorer decoration blinked. There is no moment where they *see what the
agent did* as a reviewable unit, and no way to say "keep this, undo that." The
whole change lands or the user hand-reverts in a terminal. That is the opposite
of the trust model every serious agentic editor now ships: **Cursor** stages
agent edits as inline diffs you accept/reject per hunk with a checkpoint you can
roll back to; **Claude Desktop** shows each edit as a diff card you approve. Both
make the agent's work *legible and reversible* before you commit to it.

Hive already has the raw materials — a diff renderer (`DiffView`), a full git
layer (M10), a workspace file watcher — but no flow that captures a turn's
changes, presents them as a review, and applies an accept/reject decision. This
feature builds that flow: the agent works, and its changes surface as a calm,
reviewable, reversible set the user drives with confidence.

## Goals

- [ ] **G1 — See exactly what the agent changed.** After (and while) the agent
      edits, the user sees a precise, per-file, per-hunk diff of everything it
      touched this turn — additions and removals — without opening a terminal or
      diffing by hand. Measured: every Write/Edit/Create/Delete the agent makes
      appears in the review set.
- [ ] **G2 — Accept or reject, at the granularity that matters.** The user keeps
      or reverts changes at three levels — a single hunk, a whole file, or the
      entire set — and the on-disk result matches the decision exactly. Measured:
      reject restores the pre-turn bytes; accept leaves the agent's bytes.
- [ ] **G3 — Earned familiarity (Cursor/Claude Desktop).** Someone fluent in
      Cursor or Claude Desktop sits down and it just works: inline diff in the
      editor with per-hunk controls, a change card in the chat, a "N pendentes"
      review bar, keyboard accept/reject. No re-learning.
- [ ] **G4 — Never destructive-by-surprise, always recoverable.** Because the
      optimistic model means bytes already hit disk, the checkpoint is sacred:
      the pre-turn state is always recoverable until the user explicitly accepts,
      reject is confirmable when it would discard un-viewed work, and no path can
      lose the user's *own* concurrent edits silently.
- [ ] **G5 — Beautiful, modern, intuitive, delightful.** The surface is shaped
      with the `impeccable` product register and validated pixel-by-pixel in the
      Playwright MCP (dark + light). It should feel like a first-party capability,
      not a bolted-on diff dump. (User's explicit, emphatic requirement.)

## Out of Scope

Explicitly excluded to prevent scope creep. Natural next features, not this one.

| Feature | Reason |
| --- | --- |
| **Gated / pre-approval of writes** (hold edits before disk) | Decision ACR-C1: the model is **optimistic** — the agent writes, the user reviews & reverts. A pre-approval gate (PreToolUse hook) is a different execution model, evaluated and deferred (see context.md). |
| Editing the agent's proposed change before accepting | Review is accept-as-is / reject / edit-after-accept-in-the-editor. Inline "tweak then accept" is a P3 nicety. |
| Multi-turn "undo stack" / time-travel across many past turns | v1 keeps **one** live pending set (the un-reviewed accumulation since the last clean baseline). Named/rollable historical checkpoints are P3. |
| Reviewing **Bash**-driven side effects (installs, migrations) | `acceptEdits` covers Write/Edit only; Bash effects aren't file-diffable as an intent and are out. The snapshot still captures resulting file changes. |
| Reviewing changes outside the active workspace | Capture is scoped to the workspace root (same boundary as `WorkspaceService`/`FsService`). |
| Semantic / AST-level diffs, review comments, threads | v1 is line/hunk diffs. Collaboration on a diff is a separate product. |
| Per-agent adapters emitting structured tool-use for attribution | v1 capture is **snapshot-based and adapter-agnostic** (works for Claude/Devin/Copilot alike). Precise per-tool attribution from the Claude stream is a P2 enrichment (ACR-C7). |
| Auto-commit accepted changes to the user's git | Accept keeps bytes on disk; committing is the user's existing M10 SCM flow. The two are complementary, not merged. |

---

## User Stories

### P1: The review loop ⭐ MVP

**User Story**: As a squad member, when the agent finishes (or is mid-turn) I
want to see everything it changed as a reviewable set and accept or reject it,
so I trust the agent's work without leaving the app or losing control.

**Why P1**: This is the spine — capture + diff + accept/reject. Without it there
is nothing to review. Everything else (inline editor UX, chat cards, panel
polish) hangs off this axis.

**Requirements:**

- **ACR-R1.1 — Turn checkpoint.** On agent turn start, the app records a
  race-free baseline of the workspace (pre-turn state) so any file the agent
  changes can be diffed against, and reverted to, its pre-turn content —
  including files created (revert = delete) and deleted (revert = restore).
- **ACR-R1.2 — Change capture.** When the turn produces file changes (detected
  as they stream in and finalized at turn end), the app computes the set of
  changed paths vs. the baseline: created / modified / deleted, each with its
  diff. Binary and oversized files are represented as a state, never garbled.
- **ACR-R1.3 — Pending review set.** Captured changes accumulate into a single
  live **pending set** for the workspace, surviving across turns until reviewed.
  A change the agent later re-touches updates in place (no duplicates).
- **ACR-R1.4 — Per-file diff view.** For each pending file the user sees a diff
  (reusing `DiffView`: unified/split, line numbers, add/del coloring) of pre-turn
  → current, with a header showing path + `+adds/-dels` and status (novo/
  modificado/removido).
- **ACR-R1.5 — Accept (file).** Accepting a file keeps its current on-disk bytes
  and removes it from the pending set (the current content becomes the new
  baseline for that path).
- **ACR-R1.6 — Reject (file).** Rejecting a file restores its pre-turn bytes on
  disk (created → deleted, deleted → restored, modified → reverted) and removes
  it from the pending set. The open editor, explorer, and gutter reflect it live.
- **ACR-R1.7 — Accept all / Reject all.** The user accepts or rejects the entire
  pending set in one action; reject-all is confirmed (it discards agent work).
- **ACR-R1.8 — Empty / clean state.** With no pending changes the review surface
  shows a calm empty state, never an error or a blank void.

### P1: Tiered surface (Cursor + Claude Desktop) ⭐ MVP

**User Story**: As a user, I want the review to meet me where I already am — in
the file I'm looking at, in the chat where the agent spoke, and in a persistent
"there are changes to review" affordance — matching the tools I know.

**Requirements:**

- **ACR-R2.1 — Inline editor diff (Cursor tier).** When a pending file is open in
  the editor, the agent's changes render inline as a diff (added lines green,
  removed lines red/struck) anchored in place, reusing/extending the M10 change
  gutter, with **per-hunk** `✓ Aceitar` / `✗ Rejeitar` controls and prev/next
  navigation between changes.
- **ACR-R2.2 — In-chat change card (Claude Desktop tier).** Each agent turn that
  changed files renders a compact **change card** in the chat transcript: files
  touched, `+/-` counts, and a click-through to the diff, with accept/reject for
  that turn's changes. It reflects live state (accepted files check off).
- **ACR-R2.3 — Persistent review bar.** Whenever the pending set is non-empty, a
  slim, ambient **review bar** is visible (e.g. above the composer / at the work
  surface footer) showing `N mudanças pendentes` with `Rejeitar tudo` /
  `Aceitar tudo` and a click-to-open-review affordance. It disappears when clean.
- **ACR-R2.4 — Review sidebar view.** A switchable **"Revisão do agente"** view
  in the activity rail (sibling of Explorer/Source Control) lists pending changes
  grouped by status (Criados/Modificados/Removidos), each row → its diff, with
  per-row and bulk accept/reject — the dedicated home for the set.
- **ACR-R2.5 — One source of truth.** All four surfaces read and mutate the same
  pending set: accepting a hunk inline updates the card, the bar count, and the
  panel instantly (and vice-versa). No surface can drift.

### P2: Per-hunk precision & attribution

**User Story**: As a user, I want to keep some of a file's changes and drop
others, and to trust that "the agent" changes are separated from my own edits.

**Requirements:**

- **ACR-R3.1 — Per-hunk accept/reject.** The user accepts or rejects an
  individual hunk within a file; the on-disk result is exactly that hunk applied
  (accept) or reverse-applied (reject), other hunks in the file untouched, and
  the pending set re-diffs to reflect the remainder.
- **ACR-R3.2 — Concurrent-edit safety.** If the user edited a pending file by
  hand after the turn, a reject/accept that would clobber those edits is detected
  (baseline/mtime awareness, reusing the M4 STALE convention) and surfaced as a
  choice rather than silently overwriting.
- **ACR-R3.3 — Attribution (Claude, best-effort).** Where the adapter exposes it
  (Claude stream-json `tool_use`), the review labels *why* a file changed (which
  tool/skill touched it) as enrichment. Absence degrades gracefully to the
  snapshot-only view. (Groundwork only in v1; full attribution is P2.)

### P3: Polish & recoverability

- **ACR-R4.1 — Keyboard flow.** Accept/reject/next/prev the current change from
  the keyboard, discoverable via tooltips (Cursor parity).
- **ACR-R4.2 — Undo-accept toast.** Accepting shows a brief "desfazer" affordance
  (short window) before the checkpoint for those bytes is finalized.
- **ACR-R4.3 — Workspace-switch guard.** Switching workspace / closing with a
  non-empty pending set prompts (accept / reject / keep-pending-and-leave),
  reusing the M8 unsaved-guard convention; the pending set is torn down cleanly.

---

## Non-Functional & Quality Gates

- **ACR-R9.1 — No regression.** `npm run verify` stays green (typecheck + full
  unit/component suite + lint). The agent turn-lifecycle change must not alter
  existing chat/streaming behavior for turns that change nothing.
- **ACR-R9.2 — Coverage.** ≥90% (stmts/branch/funcs/lines) per changed non-UI
  file, via the existing per-file coverage globs (new capture/review/service +
  parse/apply helpers added to the gate; large renderer shell components follow
  the existing `SkillStudio`/`McpManager` gating precedent).
- **ACR-R9.3 — i18n.** All chrome strings in `renderer/i18n/pt-BR.ts` via `t()`;
  the `noInlineStrings` test covers the new files. No inline literals.
- **ACR-R9.4 — Real-flow E2E.** An `_electron.launch` E2E drives a real turn (via
  the scripted/fake adapter writing real files) → asserts the pending set, then
  accept-keeps and reject-restores **on disk**.
- **ACR-R9.5 — Visual validation.** Every review state (inline diff w/ per-hunk
  controls, chat card, review bar, panel grouped list, empty state, reject-all
  confirm) validated in the **Playwright MCP** browser, **dark + light**, shaped
  with `impeccable`. Screenshots saved under `.playwright-mcp/`.
- **ACR-R9.6 — Performance.** Checkpoint snapshot at turn start is incremental and
  cheap (heavy dirs excluded); a 200-file diff renders without jank; capture adds
  no perceptible latency to the first streamed token.

---

## Success Criteria (demo)

A user asks the agent to refactor across three files. As the agent works, a
change card appears in the chat and the review bar reads "3 mudanças pendentes."
They open one file — the edits are inline with per-hunk ✓/✗. They reject one
hunk (it reverts on disk instantly), accept the rest of that file, open the
"Revisão do agente" panel, and `Aceitar tudo` the remainder. The pending set is
empty; the bar is gone. At no point did they open a terminal, and at every point
the pre-turn state was one click from being restored — all in dark and light,
looking unmistakably first-party.
