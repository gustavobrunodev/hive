# STATE — Hive Desktop

Persistent memory: decisions, blockers, lessons, todos, deferred ideas.
Updated as work progresses. Load at start of every session.

---

## Decisions

- **D1 — Stack: Electron + React + TypeScript.** Mandated by requirements.
  (2026-07-09)
- **D2 — UI: `@hive/design-system`.** Product-register surface; reuse DS tokens
  and components (already ships ChatMessage, MessageList, Attachment, PromptInput,
  Terminal, Tree, Resizable, Command, CodeBlock, Select, Dialog, SteppedList…).
  Mandated. (2026-07-09)
- **D3 — UX shaped by `impeccable` skill.** Mandatory for all user-facing surfaces.
  (2026-07-09)
- **D4 — Location: repo root `hive-desktop/`.** New top-level directory (NOT under
  `products/`). User decision. (2026-07-09)
- **D5 — Agent layer: internal adapter interface, Claude CLI only in MVP.** Devin
  and others are future pluggable adapters behind the same `AgentAdapter` contract.
  "ACP" is realized as our decoupled adapter boundary, not an external protocol
  spec (yet). User decision. (2026-07-09)
- **D6 — Execution model: process spawn in Electron main.** Main process spawns
  BMAD/agent CLIs (child_process / node-pty) and streams to renderer over IPC;
  the terminal is abstracted into visual UI. User decision. (2026-07-09)
- **D7 — MVP scope: full vertical slice, one workflow.** Onboarding → chat (Claude)
  → one BMAD workflow (Create PRD) → artifact visible in explorer. User decision.
  (2026-07-09)
- **D8 — Model/effort options: curated per adapter.** Each AgentAdapter declares
  supported models/efforts; UI reads from the adapter. User decision. (2026-07-09)
- **D9 — Workflow catalog: curated + dynamic fallback.** MVP ships a curated map
  of key BMAD workflows to commands; read from the installed BMAD dynamically when
  possible. User decision. (2026-07-09)
- **D10 — UI language: Brazilian Portuguese (pt-BR).** The entire interface (our
  chrome) is in pt-BR; all copy centralized in `renderer/i18n/pt-BR.ts` via a `t()`
  helper (no inline literals), locale-extensible later. Agent replies / BMAD
  artifacts are out of scope (governed by the agent/workflow). Requirement R1.6,
  task T3b. User decision. (2026-07-09)

## Blockers

- **B1 — RESOLVED (2026-07-09).** Real `bmad-method@6.10.0` install run in a
  scratchpad throwaway workspace confirmed: install is fully non-interactive
  (`install --directory <ws> --modules bmm --tools claude-code --yes`, zero
  prompts — no pty-driving needed); provisioned-detection is
  `_bmad/_config/manifest.yaml` (+ `_bmad/config.toml`); update reuses the same
  install command (`--action update` or plain `--yes` auto-detects and
  quick-updates); BMAD integrates with Claude Code via **`.claude/skills/`**
  (not `.claude/commands/` as originally assumed) and the PRD workflow is the
  `bmad-prd` skill, writing to
  `_bmad-output/planning-artifacts/prds/prd-<project_name>-<date>/prd.md` by
  default. Full detail in design.md §7 "BMAD Integration — VERIFIED". One
  open item carried forward, not a blocker: the live chat-driven PRD
  generation itself (Discovery→Finalize inside a real Claude Code
  conversation) wasn't executed — only the installed skill's own
  config/instructions were inspected — so spot-check the actual output file
  once R6/R7 chat wiring lands in M1.

## Lessons

- **Node version floor for BMAD:** `bmad-method@6.10.0` requires Node
  ≥ 20.12.0 — on 20.11 it crashes with `node:util does not provide an export
  named 'styleText'`. Verified by reproducing the crash then re-running under
  Node 22.22.1 successfully. The Electron app's Node runtime (bundled or
  system, whichever `ProcessRunner` shells out to) must satisfy this floor.
  `hive-desktop/.nvmrc` pins 22.22.1; `npm run dev`/`test`/`typecheck`/`lint`
  all need it active (`source ~/.nvm/nvm.sh && nvm use 22.22.1` — a shell's
  `nvm use` does NOT persist across separate tool invocations in an agent
  harness, only within one shell session/command — re-run it every time or
  chain it into the same command).
- **BMAD → Claude Code integration is Skills, not slash commands.**
  `--tools claude-code` writes `.claude/skills/<name>/SKILL.md` (46 skills
  observed); there is no `.claude/commands/` directory. `AgentAdapter.
  runWorkflow()` should drive this by sending a clear natural-language intent
  (Claude Code resolves skills by matching the message against each
  `SKILL.md` description), not by any CLI flag or subcommand.
- **`@hive/design-system` consumption confirmed (T3):** `"file:../design-system"`
  dependency + `npm install --install-links` (copies rather than symlinks, so
  TS module resolution walks `node_modules` normally); React 18.3.x pinned to
  match the DS's own dev-tested version. Works cleanly in an electron-vite
  renderer, ESM bundle + CSS both load without error.
- **electron-vite react-ts scaffold ships demo CSS that actively fights a real
  app** (found during T20's impeccable pass, not caught earlier): `#root`'s
  flex-centering + `body`'s hardcoded, never-`data-theme`-aware background +
  a decorative `wavy-lines.svg` image left the real app shell rendering in a
  ~1183px centered column with visible dead-background gutters on every
  screen, in every theme. Fixed by sourcing `body`'s color/background from
  the DS's real `--ink`/`--bg` tokens and stripping the scaffold's demo
  rules entirely — worth an explicit `npm run dev` + resize/theme-toggle
  visual check early next time a project starts from this template, rather
  than trusting the placeholder screens' `minHeight:100vh`/`maxWidth` inline
  styles to have quietly masked it (they did, until T19's `WorkUI` used a
  bare `height:100vh` with no `maxWidth` cap).
- **Custom-interactive DS components need their own focus-visible rule.**
  `SkillCard` (and similarly any presentational DS component wrapped with
  `role="button"`/`tabIndex` instead of a real DS interactive primitive)
  has no built-in `:focus-visible` treatment, so it silently falls back to
  the browser's default 1px outline — inconsistent with the DS's own
  `--focus` ring every real interactive component shows. `chat/IntentGrid.css`
  is the fix pattern (mirrors `Button.css`'s `inset 2px var(--focus)`); reuse
  it if another screen makes a presentational DS card clickable.
- **`ClaudeCliAdapter`'s `--effort` CLI flag is unverified** (T13) — `--model`
  and `-p`/print-mode are confirmed real flags, but no public `--effort` flag
  was found for the real `claude` CLI. Correct against real `claude --help`
  docs before relying on it; there is no real `claude` binary in this sandbox
  to verify against directly (confirmed absent, T13/T20).

## Todos (cross-feature)

- (none open)

## Deferred Ideas

- External standardized ACP (agentcommunicationprotocol.dev) adoption — revisit at
  M5 when a second adapter exists.
- Embedded real terminal (xterm.js) as an optional "advanced/transparency" view.
- Cloud sync of workspace artifacts.
- **T16 — File attachment into context [S].** Should-have, spec explicitly
  allows dropping it "if time-boxed" — deferred to keep M1 scope to the
  must-haves. `AgentAdapter.capabilities().supportsAttachments` is already
  `false` and `AgentInput`/`AgentSession` are shaped so adding it later is
  additive (agentAdapter.ts's own doc comments), not a breaking change.
- Correct `ClaudeCliAdapter`'s `--effort` flag against real `claude --help`
  once a real `claude` binary is available to verify against (see Lessons).
- Re-run `bmadCli.e2e.test.ts` (`npm run test:e2e`) and drive an actual live
  Claude Code chat conversation once a real `claude` CLI is available, to
  fully close R8.1's chat/PRD-generation leg for real (currently covered by
  scripted-fake-process tests + a live Playwright pass with `window.hive`
  stubbed — see the test file's own doc comment for the exact gap).
- Favicon 404 in the Vite dev server (harmless — Electron's window/taskbar
  icon comes from `resources/icon.png`, not a web favicon) — P3, cosmetic
  dev-console noise only.

## Preferences

- Lightweight tasks (state updates, session handoff, small doc edits) work
  well with faster/cheaper models — noted per the skill's own guidance.
