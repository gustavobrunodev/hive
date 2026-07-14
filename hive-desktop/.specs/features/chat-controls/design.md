# Design — Chat Controls

Two additive controls on the existing `Chat`/composer. No new agent plumbing for
the interrupt (reuses `agent.stop()`); one new read-only IPC for skill discovery.
Product register: familiar affordances (a Stop button while generating; a `/`
menu like every modern editor), state-conveying motion only.

---

## 1. Interrupt the running response (CC-R1)

Today `Chat` streams via `agent.onEvent`; `agent.stop()` already exists (kills the
active `claude -p` turn) and is only used on unmount. Wire it as a user control:

- **`ClaudeCliAdapter` / `AgentSession`**: mark a user-initiated stop so the
  turn's terminal event is **not** an `error`. `pipeTurn` currently emits `error`
  on signal exit. Add an `interrupted` flag set by `stop()`; when set, the killed
  turn emits a new terminal event `{ type: 'interrupted' }` (added to `AgentEvent`)
  instead of `error` (CC-R1.5). `AgentEvent` gains `| { type: 'interrupted' }`;
  `AgentSession.stop()` stays the same signature.
- **`Chat` state**: on the interrupt control, call `window.hive.agent.stop()`.
  On the `interrupted` event (or the stop resolving): flush `streamingTextRef` —
  if non-empty, commit it as a finished assistant message (CC-R1.3); if empty,
  drop it with no empty bubble. Clear `streamingText` → UI returns to idle
  (CC-R1.2). No error Alert (CC-R1.4/1.5).
- **Composer control**: `PromptInput` already takes `streaming`. Add an interrupt
  affordance shown only while `isStreaming`. Preferred: a dedicated **Stop button**
  in the composer toolbar (square-in-circle icon, `t('chat.stopLabel')`,
  `aria-label`), so Send/Stop are both discoverable. If `PromptInput`'s send
  button doubles as stop when `streaming` (check its API first), use that; else
  render our own toolbar Stop button. Visual: a quiet danger-tinted icon button
  (not full-saturation), 150ms hover.
- Session stays usable after (per-turn processes) — next `send` spawns fresh
  (CC-R1.4). `AgentService`/`main` need no new method; `agent.stop()` already
  routes to the session.

Note: after a stop, we do **not** auto-restart the session (unlike the model-
change effect). The adapter spawns per-turn, so the session object is still valid;
only the in-flight process was killed.

## 2. Slash-command (skills) menu (CC-R2/R3)

### Discovery IPC (agent-agnostic, CC-R3)
`workflowCatalog.ts`: add `listSkills(workspaceRoot): Promise<SkillEntry[]>` that
parses the **full** `bmad-help.csv` (reusing `parseBmadHelpCsv`) into
`{ key: skill, label: displayName, description }[]` (dedup by skill, skip
`_meta`/empty). This surfaces all ~34 workflow skills, not just the curated five.
IPC: `skills.list(workspace)` (new namespace, plain invoke/response). Empty/missing
CSV → `[]` (CC-R2.5). Personas (`bmad-agent-*`) aren't in the CSV → not in the
slash menu (they're reached via role actions) — documented, expected.

Claude-CLI native slash commands are unavailable in `-p` mode (verified — print
mode runs one non-interactive turn, no interactive `/` surface), so the app
supplies its own; the source is BMAD workspace metadata, keeping it agent-agnostic
(CC-R3.2).

### Menu UI (`SlashMenu.tsx` — new, app-level)
- Trigger: `Chat` watches the `PromptInput` value; when it is exactly `/` or
  starts with `/` followed by no space, open the menu with the query = text after
  `/`. Deleting the `/` or typing a space closes it (CC-R2.2).
- A popover list anchored above the composer (the composer sits low, so open
  **upward**), rendered in a portal / `position: fixed` to escape the composer's
  `overflow` (impeccable interaction rule). Uses DS `Command`/`Popover` if it fits
  the anchored-to-textarea need; otherwise a small bespoke list styled with the
  `.wb-*` menu vocabulary (matches the workspace chip menu).
- Rows: skill label (bold) + truncated description (muted). Type-to-filter
  (case-insensitive over label/key/description). Keyboard: ↑/↓ roving highlight,
  Enter selects, Esc closes; focus stays in the textarea (menu is a listbox the
  textarea controls via `aria-activedescendant`) — never traps focus (CC-R2.3).
- Select → `agent.runWorkflow({ key: skill, prompt: "Use the <skill> skill." })`,
  clear the composer, close menu (CC-R2.4) — same turn semantics as an intent /
  rail action.
- Empty query with no skills, or a filter with no match → a teaching empty row
  ("Nenhuma skill encontrada" / "Nenhuma skill disponível neste workspace")
  (CC-R2.5).
- Motion: 120ms fade+rise on open, reduced-motion → instant.

## 3. Ownership map
| Concern | Where | New/changed |
|---|---|---|
| `interrupted` event + user-stop flag | `main/agentAdapter.ts`, `main/claudeCliAdapter.ts` | changed |
| Interrupt wiring + Stop control | `renderer/chat/Chat.tsx` | changed |
| Full skill discovery | `main/workflowCatalog.ts` | changed |
| `skills.list` IPC | `main/index.ts`, `preload/index.ts` | changed |
| Slash menu | `renderer/chat/SlashMenu.tsx` | new |
| Icons (stop, slash) | `renderer/ui/icons.tsx` | changed |
| Copy | `renderer/i18n/pt-BR.ts` | changed |
| Styles | `renderer/assets/workbench.css` | changed |

## 4. Testing
- Adapter: a `stop()` during a running turn emits `interrupted`, not `error`;
  partial output already delivered as `token`s is unaffected.
- `Chat`: Stop control appears only while streaming; clicking commits non-empty
  partial as an assistant message, drops empty; no error Alert; next send works.
- `workflowCatalog.listSkills`: full list, dedup, empty on missing CSV.
- `SlashMenu`: opens on `/`, filters, keyboard nav, select launches + clears,
  empty state. ≥90% per-file.
- Visual `_electron.launch`: streaming→Stop, and the `/` menu open + filtered.

## 5. Risks
- **Interrupt race**: the killed process may still flush a final chunk; committing
  `streamingTextRef` on the terminal event (not eagerly on click) avoids losing or
  double-counting text. The `interrupted` terminal event is the single commit
  point.
- **Slash false-trigger**: only a leading `/` (optionally followed by query, no
  space) opens the menu, so `/` mid-sentence (e.g. a path) doesn't hijack typing.
