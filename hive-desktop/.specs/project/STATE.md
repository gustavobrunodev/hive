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

- **D11 — Feature `file-management` (expands M4).** Full in-app file CRUD +
  OS import. Decisions (2026-07-11): (a) **E2E = Playwright driving real
  Electron** (`_electron.launch`), new `test:e2e:app` script kept separate from
  the vitest node smoke; (b) **delete = OS trash** (`shell.trashItem`) +
  confirm; (c) **conflict = prompt per item** (Overwrite/Rename/Cancel), service
  stays mechanism-only; (d) **edit = save + concurrent-write (STALE) detection**
  via mtime baseline. `FsService` stays Electron-free via injected `trashItem`
  (DI, like `WorkspaceService`'s `DialogLike`). Coverage gate is **per-file 90%**
  on changed files (not global). Plan in `.specs/features/file-management/`.
  (2026-07-11)

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
  default. Full detail in design.md §7 "BMAD Integration — VERIFIED".
- **B2 — RESOLVED (2026-07-10).** Live chat-driven PRD generation verified
  against a real `claude` CLI binary (v2.1.206, authenticated) in a throwaway
  workspace: `claude -p "use the bmad-prd skill to create a PRD..." --model
  sonnet --effort low --permission-mode acceptEdits` produced a real
  `prd.md` at the exact path B1 predicted. This also confirmed `--effort`
  is a real flag and surfaced a real bug, now fixed — see Lessons.

## Lessons

- **`sandbox: true` + electron-vite's default preload externalization is a
  broken combo — found via a real `npm run dev` crash (2026-07-10).**
  Symptom: app window loads to Vite's red error overlay, no useful message
  in the terminal (only WSL-noise dbus/dconf lines). Root cause: with
  `sandbox: true` (src/main/index.ts), the preload script runs in a
  restricted context that cannot resolve third-party `node_modules` at
  runtime — only `electron`/Node builtins work unbundled. electron-vite
  defaults `build.externalizeDeps: true` for the preload target, which
  leaves `@electron-toolkit/preload` as a runtime `require()` that then
  fails ("module not found"), so `window.hive` never gets exposed via
  `contextBridge` and every renderer screen crashes reading `undefined`.
  Fixed in `electron.vite.config.ts` by setting `preload.build.
  externalizeDeps: false` (bundles `@electron-toolkit/preload` inline;
  `electron`/builtins stay external via electron-vite's own preload preset
  regardless). Diagnosed by temporarily wiring `webContents.on('console-
  message', ...)` in `src/main/index.ts` and running under `xvfb-run` — the
  terminal alone never surfaces renderer-side errors.
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
- **`ClaudeCliAdapter` fully verified live (2026-07-10) against a real `claude`
  binary (v2.1.206).** `--model`, `-p`, `--effort` (`low|medium|high|xhigh|max`)
  all confirmed real. Fixed two real defects found by the live run: (1)
  `capabilities()` listed stale pinned model ids (`claude-opus-4-5` etc.) —
  changed to the alias ids `--help` itself recommends (`opus`/`sonnet`/
  `haiku`), which don't churn as model generations ship; (2) `spawnTurn` never
  passed `--permission-mode`, so `-p` silently refused all tool-driven writes
  ("I don't have permission to write there yet") — any real "Create a PRD"
  run would have failed to ever produce the artifact. Fixed by adding
  `--permission-mode acceptEdits` (covers Write/Edit; Bash-driven BMAD
  sub-steps like `uv run` scripts still get skipped under it — fine for the
  MVP's single skill-driven workflow, revisit if a future workflow needs
  Bash).
- **`bmad-method install --directory <path>` does not fully sandbox the
  install** when invoked from a different cwd — `.claude/skills/bmad-*`,
  `.agents/skills/`, `.agents/.skill-lock.json`, `.github/agents/*.agent.md`
  are written relative to the invocation cwd, not `--directory` (only
  `_bmad/` and `_bmad-output/` respect it). Caused real untracked pollution
  in the `hive` monorepo root during this session's live-CLI validation
  (left in place per user choice, not cleaned up — see repo root `git status`
  if this needs addressing later). Always `cd` into the target directory
  before calling `bmad-method install` rather than trusting `--directory`
  alone.
- **T2 spike — Playwright `_electron.launch` works fine in this WSL2/xvfb env,
  once one env var is stripped.** `@playwright/test` + `_electron.launch`
  driving the real built app (`out/main/index.js`) is NOT flaky here (contrary
  to design.md's flagged risk) — `xvfb-run -a npm run test:e2e:app` passes
  reliably, same `xvfb-run` pattern already proven for other Electron smokes.
  The one real gotcha: this dev shell has `ELECTRON_RUN_AS_NODE=1` set ambient
  (WSLENV Windows-interop leak) — the `electron` binary's own env, when
  inherited by a spawned Electron process, makes it run the target script as
  plain Node instead of booting the Electron app (`electron.app` is
  `undefined`, `_electron.launch()` fails with "Process failed to launch!").
  Fix: strip `ELECTRON_RUN_AS_NODE` from the `env` passed to
  `_electron.launch({ env })` inside the spec itself (see
  `e2e/app-launch.spec.ts`) so the harness doesn't depend on the caller's
  shell state — same "don't rely on ambient shell state" lesson as the nvm
  finding above. Run command: `npm run build && xvfb-run -a npm run
  test:e2e:app` (new script, kept separate from the vitest `test:e2e` node
  smoke). `window.hive.fs` does not exist yet (lands at T7) — the T2 smoke
  asserts `window.hive` + a current top-level method (`listTree`) instead;
  revisit once T7 lands.
- **T2 smoke's `hasFsNamespace` assertion had gone stale by T11.** T7 landed
  the `fs` namespace (as the T2-era comment anticipated it would) but nobody
  came back to flip the assertion from `false` to `true` — `app-launch.spec.ts`
  was silently failing (not "must not regress", already regressed) before this
  task started. Fixed as part of T11 (in scope: "must not regress" implies the
  smoke has to actually pass). Lesson: a spec comment that says "revisit once
  X lands" is a todo, not documentation — grep for those phrases when a
  dependency task completes, don't wait for CI to notice.
- **T11 — workspace-selection-for-tests approach: seed `userData/config.json`
  directly, don't drive the native picker dialog.** `WorkspacePicker`'s CTA
  opens a real OS `dialog.showOpenDialog` — not scriptable from Playwright.
  Electron's standard `--user-data-dir=<dir>` CLI switch is untouched by this
  app (`configStore.ts`'s `baseDir` is exactly `app.getPath('userData')`), so
  `_electron.launch({ args: [appPath, `--user-data-dir=${throwawayUserDataDir}`] })`
  plus a pre-written `config.json` (`{ workspacePath, provisioned: true }`)
  boots the app straight past the picker — no dialog automation needed. Note
  this only skips *first-run install*; `provisioned: true` is never read by
  `updateBmad()`'s `update()` path (see next lesson), so `App.tsx` still lands
  on `UpdateGate` every launch, seeded or not.
- **T11 — `UpdateGate` always shells out to a real `npx bmad-method install`,
  every launch, with no test-mode bypass anywhere in main/preload/renderer.**
  Checked `bmadService.ts`: `configStore.provisioned` is written by
  `install()`'s success callback but never read by `update()` to short-
  circuit it. There is no `HIVE_E2E`/`SKIP_ONBOARDING`-style env var in this
  codebase. `UpdateGate` does expose a sanctioned escape hatch for exactly
  this (R4.2's "continue anyway" on an `error` event), which
  `file-management.spec.ts` races against the happy path and clicks if hit —
  legitimate, not a workaround.
- **T11 — real blocker found: the app currently crashes before ever reaching
  the work UI, due to a duplicate-React-module-instance bug, unrelated to
  file-management.** Diagnosed via a throwaway Playwright script that dumped
  `document.body.innerHTML` + console/pageerror events over time (rather than
  re-running the full 7-minute E2E spec repeatedly): the renderer's `#root`
  never gets content: `Spinner` (rendered by `App.tsx`'s `checking`/
  `checkingProvisioned` states, i.e. *before* `UpdateGate` is even reached)
  throws `Cannot read properties of null (reading 'useState')` — a classic
  invalid-hook-call symptom. Root cause: `node_modules/react` resolves to two
  physically different copies — `hive-desktop/node_modules/react` vs
  `design-system/node_modules/react` (the `file:../design-system` link has no
  dedupe) — so a `@hive/design-system` component's hooks run against a
  different React module instance than the app's own render tree uses. This
  predates T11 and is unrelated to the file-management IPC/UI code (the
  working tree also has a substantial in-progress, uncommitted design-system
  rework layered on top — see the repo-root `git status` note any session
  picks up here). Per the task's own instruction and design.md's flagged
  E2E-instability risk allowance, `e2e/file-management.spec.ts` is left
  committed as a correct, ready-to-pass local gate rather than blocked on
  fixing an unrelated, in-flight dependency issue — **it currently cannot
  complete in this sandbox** (confirmed via two full runs, one with a 200s
  and one with a 420s onboarding-wait budget — both timed out because the
  screen never renders past a blank `#root`, not because anything was
  legitimately slow). Whoever resolves the design-system rework's React
  duplication should re-run `npm run build && xvfb-run -a npm run
  test:e2e:app` — expected to pass once `#root` actually renders.

## Todos (cross-feature)

- **file-management (T1–T11) implemented on `main`.** Feature complete —
  create/edit/delete/rename/move/import, security, conflicts, coverage gate,
  E2E spec. The E2E spec (`e2e/file-management.spec.ts`) is correct but
  currently blocked from completing by the unrelated React-duplication crash
  above — re-run once that's fixed. ROADMAP M4 marked done.

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
- ~~Correct `ClaudeCliAdapter`'s `--effort` flag / drive a live PRD generation
  once a real `claude` CLI is available~~ — DONE 2026-07-10, see Lessons (B2).
  `bmadCli.e2e.test.ts` still covers install/update only (no real `claude`
  binary in the automated test environment); the live chat leg was validated
  manually, not added to the automated E2E suite.
- Favicon 404 in the Vite dev server (harmless — Electron's window/taskbar
  icon comes from `resources/icon.png`, not a web favicon) — P3, cosmetic
  dev-console noise only.

## Preferences

- Lightweight tasks (state updates, session handoff, small doc edits) work
  well with faster/cheaper models — noted per the skill's own guidance.
