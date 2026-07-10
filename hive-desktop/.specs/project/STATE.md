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
- **BMAD → Claude Code integration is Skills, not slash commands.**
  `--tools claude-code` writes `.claude/skills/<name>/SKILL.md` (46 skills
  observed); there is no `.claude/commands/` directory. `AgentAdapter.
  runWorkflow()` should drive this by sending a clear natural-language intent
  (Claude Code resolves skills by matching the message against each
  `SKILL.md` description), not by any CLI flag or subcommand.

## Todos (cross-feature)

- Confirm `@hive/design-system` is consumable from an Electron renderer build
  (ESM bundle + CSS); check peer React 18 alignment.

## Deferred Ideas

- External standardized ACP (agentcommunicationprotocol.dev) adoption — revisit at
  M5 when a second adapter exists.
- Embedded real terminal (xterm.js) as an optional "advanced/transparency" view.
- Cloud sync of workspace artifacts.

## Preferences

- (none recorded yet)
