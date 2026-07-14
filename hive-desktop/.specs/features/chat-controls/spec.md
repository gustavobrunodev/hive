# Feature: Chat Controls

**Milestone:** M2 (Chat completeness — first slice)
**Status:** 📝 Planned (2026-07-13)

Two controls that make the chat feel like a real conversation surface instead
of a fire-and-forget prompt box: **interrupt a running response** and a
**slash-command menu** for discovering and launching workspace BMAD skills.

---

## Problem

1. Once a turn is sent, the only way out of a long or wrong-headed agent
   response is to wait for it to finish. There is no visible way to stop it,
   even though the underlying `AgentService.stop()` already kills the active
   `claude -p` process.
2. The workspace exposes dozens of BMAD skills (`.claude/skills/*`,
   `_bmad/_config/bmad-help.csv`), but the only way to reach them from chat is
   to know the right natural-language phrasing. There is no discovery inside
   the composer.

## Solution

- A **stop/interrupt affordance** on the composer, visible only while the agent
  is streaming, that interrupts the in-flight turn and returns the UI to idle,
  keeping whatever partial text already streamed as a finished assistant
  message.
- A **slash-command menu**: typing `/` in an empty composer opens a keyboard-
  navigable, type-to-filter list of the workspace's discovered BMAD skills;
  choosing one launches that skill's workflow. Discovery reuses the existing
  `workflowCatalog` machinery (extended to surface the full skill list, not
  just the curated five).

---

## Requirements

### CC-R1 — Interrupt the running response
- **CC-R1.1** While a turn is streaming (`streamingText !== null`), the composer
  shows an **interrupt** control (replacing/adjacent to Send) labelled per i18n.
- **CC-R1.2** Activating it calls `window.hive.agent.stop()`, which kills the
  active turn's process, and immediately returns the chat to idle
  (no `TypingIndicator`, Send re-enabled).
- **CC-R1.3** Any text that already streamed is preserved as a completed
  assistant message (never discarded); an interrupted turn with **zero** streamed
  text leaves no empty assistant bubble behind.
- **CC-R1.4** After an interrupt, the session is still usable: the next `send`
  starts a fresh turn (the adapter spawns per-turn processes, so no restart of
  the whole session is required). A clear, non-alarming status is acceptable but
  no `error` Alert is shown for a user-initiated interrupt.
- **CC-R1.5** The interrupt must not fire the adapter's `error` event path as a
  failure — a user-initiated stop is a normal outcome, not a claude crash.

### CC-R2 — Slash-command (skills) menu
- **CC-R2.1** Typing `/` as the first character in the composer opens a menu
  listing the workspace's available BMAD skills (key, human label, description).
- **CC-R2.2** Continuing to type after `/` filters the list (case-insensitive
  match on label/key/description); `Esc` or deleting the `/` closes it.
- **CC-R2.3** The menu is keyboard-navigable (↑/↓ to move, Enter to choose) and
  mouse-clickable; it never traps focus away from the textarea.
- **CC-R2.4** Choosing an entry launches that skill as a workflow turn
  (`agent.runWorkflow`) and clears the composer — same turn semantics as an
  intent-grid click.
- **CC-R2.5** When discovery finds no skills (no BMAD installed / empty CSV), the
  menu shows a clear empty state rather than nothing.

### CC-R3 — Discovery source (agent-agnostic)
- **CC-R3.1** Skills are discovered via the main process from
  `<ws>/_bmad/_config/bmad-help.csv` (the source `workflowCatalog` already
  parses), exposed through an IPC method that returns the **full** skill list
  for the active workspace.
- **CC-R3.2** Whether the underlying agent CLI already provides slash-command
  discovery is documented: the Claude CLI's own slash commands are **not**
  available in `-p` (print) mode, so the app supplies its own — verified and
  recorded in design.md. The discovery/menu contract stays agent-agnostic (it
  reads BMAD's workspace metadata, not a Claude-specific surface).

### CC-R4 — Quality gates
- **CC-R4.1** No regression: full `npm run test` green, `npm run typecheck`
  clean, no new `npm run lint` errors from this feature's files.
- **CC-R4.2** ≥90% per-file coverage on every file this feature changes
  (repo convention).
- **CC-R4.3** All new UI copy in `renderer/i18n/pt-BR.ts` via `t()` — no inline
  literals (D10 / `noInlineStrings.test.ts`).
- **CC-R4.4** Visual behavior validated in the running app via
  `_electron.launch` (the repo's working Electron-native Playwright path — the
  Playwright **MCP** tools cannot reach this app's renderer, per STATE.md T14).

---

## Non-Goals
- Persistent, mid-turn-interruptible interactive sessions (pty-backed). The
  interrupt kills the current one-shot turn; it does not pause-and-resume a
  single generation. (Deferred — processRunner.ts's documented pty extension.)
- Editing/authoring skills from the menu; it is discovery + launch only.
- Rich per-skill argument prompting; a chosen skill launches with its default
  natural-language prompt.
