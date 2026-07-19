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

- **D12 — Feature `explorer-editor-ux` (M7).** 7 UX improvements on M4's file
  management, planned 2026-07-11 (spec/design/tasks/context in
  `.specs/features/explorer-editor-ux/`). Gray-area decisions (context.md):
  (C1) editable files **open in raw edit** by default, preview is a toggle;
  (C2) Markdown preview uses **`react-markdown`+`remark-gfm`** (real dep,
  replaces the hand-rolled `ui/markdown.tsx`); (C3) multi-select is **full
  OS-like** — Ctrl/Shift select drives **bulk delete + bulk drag-move**
  (supersedes M4's single-item non-goal); (C4) HTML preview is a **sandboxed
  `srcdoc` iframe + auto-reload** (no local HTTP server — relative-asset support
  deferred). Requires the DS `Tree` (`design-system/src/components/Tree`)
  extended to be **modifier-aware** (Ctrl/Meta toggle, Shift range from an
  anchor over its visible-flat order) — additive, single-mode unchanged. User
  rules: validate every visual behavior via the **Playwright MCP**; free to
  extend/create DS components for UX. (2026-07-11)

- **D13 — Feature `workspace-switching` (M8).** VsCode-style in-app workspace
  switching, planned 2026-07-12 (spec/context/design/tasks in
  `.specs/features/workspace-switching/`). Gray-area decisions (context.md):
  (C1) switch affordance = the topbar workspace-chip **menu** with "Abrir
  pasta…" + a persisted **Recentes (MRU)** list — no native OS menu bar in v1;
  (C2) switching with unsaved edits reuses the explorer-editor-ux **three-way
  save dialog** and tears down the active agent session; (C3) **same window**,
  context replaced in place (no multi-window); (C4) install-vs-update is decided
  by a **disk check of `<ws>/_bmad/_config/manifest.yaml`** per-path (Blocker
  B1's marker), **replacing** reliance on the global `config.provisioned` flag —
  this also fixes a latent first-run bug where picking an already-provisioned
  folder reinstalled instead of updating; (C5) the file/editor **engine stays
  bespoke** — a VsCode-engine swap (code-oss/Theia) and even Monaco (editor-only)
  were evaluated mid-planning and explicitly **rejected/not-queued** (contradicts
  G5 "first-party, not a wrapper", discards M4/M7; the desired VsCode-like UX is
  a thin layer over the existing engine). `provisioned` config flag is kept but
  vestigial for routing. User decisions. (2026-07-12)

- **D14 — Feature `chat-controls` (M2 slice).** Planned 2026-07-13
  (spec/context/design/tasks in `.specs/features/chat-controls/`). (CC-C1)
  "Pausar o chat" = **interrupt the in-flight turn** (kill the active `claude -p`
  via the existing `AgentService.stop()`), keeping partial streamed text — there
  is no persistent generation to pause-and-resume (adapter spawns one one-shot
  process per turn, no stdin). A new `{ type: 'interrupted' }` `AgentEvent` marks a
  user stop so it isn't treated as a claude `error`. (CC-C3/C4) A **slash menu**
  (leading `/`) lists workspace BMAD skills from a new
  `workflowCatalog.listSkills` over the full `bmad-help.csv` via a `skills.list`
  IPC — agent-agnostic (BMAD metadata, not a Claude surface; the CLI's own slash
  commands don't exist in `-p` mode). Personas (`bmad-agent-*`) aren't in the CSV
  so they won't appear in the slash menu (reached via role actions instead).
  User decision + agent resolution. (2026-07-13)

- **D15 — Feature `agent-selection` (M5 slice).** Planned 2026-07-13
  (spec/context/design/tasks in `.specs/features/agent-selection/`). (AG-C1)
  Scope = registry + global persistence + picker UI + re-bindable `AgentService`
  now; **no real Devin adapter** (no Devin CLI in this env — it's a cloud agent,
  not a local `-p` CLI). `devin` is a visible `available:false` placeholder ("Em
  breve"); Claude stays functional; a genuine second adapter later is one registry
  entry. (AG-C2) Global scope (matches profile). (AG-C3) Rides the required
  first-run setup + the profile gear. (AG-C4) Changing agent re-binds the live
  session (adds `agent` to `Chat`'s session-effect deps). Agent-resolved scope +
  user profile-scope decision. (2026-07-13)

- **D16 — Feature `role-personalization` (M9, new milestone).** Planned 2026-07-13
  (spec/context/design/tasks in `.specs/features/role-personalization/`). User
  discuss answers (2026-07-13): (RP-C1) profile scope = **global** (app-wide, in
  `ConfigStore.role`); (RP-C2) the role picker is a **required** first-run step
  (blocking; skipped once set); (RP-C3) the always-available shortcuts live in a
  **persistent left action rail** (chosen over a ⌘K palette and a topbar dropdown),
  a fixed chrome column OUTSIDE the resizable body so `hive.workLayout` is
  untouched. (RP-C4) personas map to verified BMAD agent skills (John=`bmad-agent-pm`,
  Winston=`bmad-agent-architect`, Sally=`bmad-agent-ux-designer`, Murat=`bmad-tea`,
  Amelia=`bmad-agent-dev`), launched via natural-language `runWorkflow` prompts.
  (RP-C5) role actions become **genuinely launchable** (supersedes the MVP's
  only-`prd`-wired catalog) — each carries a real skill prompt; only live
  (non-deprecated) skill names used. (RP-C6) onboarding order: workspace → agent
  step → role step → install/update → work UI (agent+role one-time global, never
  re-prompted on a workspace switch). Verified: the `bmm` module (always
  installed/recommended) ships all mapped skills incl. personas + testarch under
  `.claude/skills/` — but personas/testarch are NOT in `bmad-help.csv` (bmm
  workflow catalog only), so they resolve via natural language, not via the
  CSV-fed slash menu. Shaped with `impeccable` product register (D3). New chrome
  (`ActionRail`, `RoleCard`, `RoleSetup`, `AgentSetup`, `ProfileSheet`) added at
  the app level, extending DS (user rule C7). Note: `impeccable`'s `context.mjs`
  reports NO_PRODUCT_MD (no impeccable-format PRODUCT.md at hive-desktop root);
  used the DS's committed brand tokens + `product.md` register reference +
  `workbench.css` conventions instead of running the full init (identity-
  preservation path) — a PRODUCT.md could be authored later. (2026-07-13)

- **D17 — Feature `shortcut-customization`.** The hero pills + composer strip
  become user-customizable: any workspace skill can be a workflow shortcut and
  any number of specialist agents can be persona shortcuts, role defaults
  remaining the zero-config baseline. Decisions: (SC-1) catalog source is
  `_bmad/_config/skill-manifest.csv` (the only BMAD-installed catalog listing
  the `bmad-agent-*`/`bmad-tea` persona skills; `bmad-help.csv` contributes
  friendlier display names and is the workflow-only fallback for older
  installs). Agent classification is data-driven: description matches
  "talk to <persona>" (also yields the persona name) or the skill path has an
  `/agents/` segment — `bmad-agent-builder` correctly stays a workflow.
  DEPRECATED shims filtered. (SC-2) prefs are **global** (`ConfigStore.
  shortcuts: { skills[], agents[] } | null`, same scope rationale as RP-C1);
  `null` = role defaults, and "Restaurar padrão do papel" writes `null` back.
  Selection order is meaningful (toggle-on appends). (SC-3) resolution
  (`roleCatalog.resolveShortcuts`) validates prefs against the *current*
  workspace's catalog — a skill not installed here is skipped, an empty
  catalog falls back to role defaults, an intentionally empty selection is
  respected. (SC-4) the picker (`ShortcutCustomizer`) is a DS `Dialog` +
  `Command` (cmdk) with **Agentes**/**Skills** groups, persona-initial
  avatars, live "n de m" counts, and immediate persistence per toggle — the
  hero/strip behind the dialog are the live preview. cmdk's fuzzy filter was
  replaced with accent-insensitive substring matching (`ui/shortcutSearch.ts`)
  — fuzzy over long description keywords matched nearly everything. (SC-5)
  pt-BR labels for the full stock catalog live in `i18n/pt-BR.ts`
  (`skillLabelsPtBR` + `agentMetaPtBR`; `shortcutLabel()` falls back to the
  catalog label then the key, and composes "Conversar com <persona>" for
  unknown agents). Entry points: a dashed "Personalizar" ghost pill in the
  hero row and a pinned sliders control after the strip's scrollable chip
  track (`.wb-shortcut-strip-scroll`). (2026-07-17)

- **D18 — Feature `skill-studio` ("Estúdio de skills").** Implemented 2026-07-18.
  In-app creation of user skills/agents WITH evals, powered by the BMAD builder
  skills, integrated with shortcut-customization (D17). Decisions:
  (SS-1) **creation is a conversation** — the studio composes a pt-BR briefing
  whose first line is the slash invocation (`/bmad-workflow-builder` for
  skills, `/bmad-agent-builder` for agents; evals run via
  `/bmad-eval-runner <path>`, evals-added-later via the builder's Edit
  intent) and hands it to the chat through the existing
  `ChatHandle.launchAction` path — the studio never talks to the agent
  itself (`ui/studioPrompts.ts`). Briefings pin the install location to
  `.claude/skills/<slug>/` (where Claude Code resolves skills) and, for
  agents, require the "Use when the user asks to talk to <Persona>"
  description phrase so the catalog classifier recognizes them.
  (SS-2) **"created by you" is data-driven, not tracked**: `main/skillStudio.ts`
  scans `.claude/skills/*/SKILL.md` and treats any directory NOT in
  `_bmad/_config/skill-manifest.csv` as user-created (minimal frontmatter
  parser, no YAML dep; agent-vs-skill via the exported
  `workflowCatalog.classifySkill`). Evals discovered at `<skill>/evals/`
  (bmad-eval-runner's primary location), cases counted best-effort from
  .json/.jsonl. (SS-3) **catalog merge, not a parallel registry**:
  `listCatalogWithCreated` appends creations as `custom: true` entries to the
  shortcut catalog (so `resolveShortcuts` validates pins with zero changes;
  `shortcuts:catalog`/`shortcuts:actions` handlers now use it), and
  `listSkillsWithCreated` feeds the slash menu (`skills:list`) so
  `/minha-skill` autocompletes as soon as the builder finishes.
  `ResolvedRoleAction`/renderer `RoleAction` carry an optional `custom` flag —
  custom shortcut pills get the studio's spark icon. (SS-4) surfaces: rail
  button (`data-tour="studio"`) → `ui/SkillStudio.tsx` dialog (gallery cards
  with test/evals/pin/open-SKILL.md/trash actions; teaching empty state; short
  create form with live `/slug` preview + "gerar evals junto" default-ON);
  ShortcutCustomizer gains a "Criadas por você" group + footer "Criar skills
  no Estúdio" link; delete = `fs.trash` on the skill dir after confirm (also
  un-pins from stored prefs). (SS-5) new IPC: `studio:list` →
  `window.hive.studio.list(workspace)`, request/response. Gates: 640 unit
  tests green (16 new SkillStudio renderer tests, 9 main scanner tests,
  preload/index/customizer additions), typecheck clean, 0 new lint errors
  (one non-blocking max-lines warning on StudioDialog); visual pass done in
  the Playwright MCP browser via the static-build + window.hive-mock recipe
  (dark+light, gallery/create/empty/delete/customizer/slash-menu/pinned-hero
  screenshots in `.playwright-mcp/`). (2026-07-18)

- **D19 — Feature `mcp` ("Servidores MCP").** Implemented 2026-07-18. In-app
  management of the workspace's Model Context Protocol servers — the Claude
  Desktop connector experience (activate/disable, live connection test with
  status + exposed tools + logs, add/edit/remove, curated presets). Decisions:
  (MCP-1) **Claude Code-native on-disk contract, no sidecar registry.** The
  catalog is the CLI's own project-scoped `<ws>/.mcp.json`
  (`{ mcpServers: { name: { command,args,env } | { type:'http'|'sse',url,headers } } }`);
  enabled state is the CLI's `<ws>/.claude/settings.local.json` with
  `enableAllProjectMcpServers:true` + a `disabledMcpjsonServers` denylist (so
  new servers are on by default — the desktop expectation — and the app IS the
  approval surface). `main/mcpService.ts` owns both files (atomic temp+rename
  writes, preserves unknown keys); nothing drifts from what `claude` reads.
  (MCP-2) **Status/tools/logs = a live probe, injected for testability.**
  `main/mcpProbe.ts` runs the real MCP JSON-RPC handshake (`initialize` +
  `notifications/initialized` + `tools/list`): stdio via `child_process` with
  stdin (the existing `ProcessRunner` has no stdin, so a dedicated `McpProbe`
  dependency is injected into `McpService` — the DialogLike/trashItem DI
  convention — keeping the service unit-testable with a fake, real probe wired
  in `index.ts`), remote via `fetch` Streamable-HTTP. Time-boxed (10 s); ENOENT
  / early-exit / refuse map to `ok:false` with a pt-BR reason; stderr captured
  as the log feed. (MCP-3) **Surface = a full module Dialog off the ActionRail
  plug button (`ui/McpManager.tsx`), rows not cards** (denser/scannable than
  the studio's gallery; status via dot+pill, never a colored side-stripe);
  curated real-server presets (`ui/mcpForm.ts`, `{workspace}`-substituted) as
  the empty-state + add-form starters. New DS-adjacent icons
  (Plug/Broadcast/Terminal/Tools/Zap/StatusDot/AlertTriangle). Six `mcp:*` IPC
  handlers under `window.hive.mcp.*`. Gates: 720 unit tests green (mcpService
  100%, mcpForm 100%, mcpProbe fixture-driven, McpManager ~99% stmt/lines,
  index/pt-BR/icons/WorkUI gated files kept green; McpManager left ungated like
  its sibling SkillStudio.tsx), typecheck clean, 0 lint errors; visual pass in
  the Playwright MCP browser (dark: list / connected-with-tools+logs / add-form
  presets). Pre-existing note: `Explorer.tsx` coverage was already red from an
  unrelated in-flight refactor (uncommitted at session start) — untouched here.
  (2026-07-18)

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

- **A `file:`-linked React package that ships its own `node_modules/react`
  duplicates React in the renderer → "invalid hook call" crash (2026-07-11).**
  Symptom: `#root` never gets content; the very first DS-backed component's
  hook (`Spinner`'s `useState`) throws
  `Cannot read properties of null (reading 'useState')` before any app UI
  mounts. Cause: `@hive/design-system` (`file:../design-system`) is bundled
  with react/react-dom kept `external` (`design-system/build.mjs`), so Vite
  resolves those imports relative to the linked package's own
  `node_modules/react` — a *second physical copy* alongside
  `hive-desktop/node_modules/react`. Two React instances in one renderer =
  invalid hook call. Fix: `renderer.resolve.dedupe: ['react', 'react-dom']`
  in `electron.vite.config.ts` (Vite's canonical dedupe for linked packages) —
  forces a single copy. `npm`'s `file:` link does no hoisting/dedupe on its
  own, so any future linked package that carries React needs this to hold.
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
- **T11 — RESOLVED (2026-07-11): the duplicate-React-module-instance crash is
  fixed.** Fix: added `resolve.dedupe: ['react', 'react-dom']` to the `renderer`
  config in `electron.vite.config.ts`. The DS bundle keeps react/react-dom
  `external` (`design-system/build.mjs`), so Vite was resolving those imports
  relative to the linked package (`design-system/node_modules/react`) — a
  different physical copy than the app's — bundling two Reacts into one
  renderer. `dedupe` forces every react/react-dom import to the app's single
  copy. Verified under `xvfb-run` (throwaway-userData Playwright launch): `#root`
  now renders the full `.wb-app` shell (~58 KB), **0 page errors, 0
  invalid-hook-call errors** (previously `Spinner` threw
  `Cannot read properties of null (reading 'useState')` before `#root` got any
  content). `e2e/file-management.spec.ts` should now be re-runnable via
  `npm run build && xvfb-run -a npm run test:e2e:app`. Original diagnosis
  retained below.
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
- **T14 — real bug found by E2E validation: `react-resizable-panels` v4
  treats bare numeric `minSize`/`maxSize`/`defaultSize` as PIXELS, not
  percent (2026-07-12).** `WorkUI.tsx`'s `ResizablePanel`s passed plain
  numbers (`minSize={12} maxSize={40} defaultSize={22}` etc.) intending
  percentages, matching the DS `Resizable` doc comment's claim of "minSize/
  maxSize/collapsible per react-resizable-panels" — but the installed
  `react-resizable-panels@4.12.0`'s own type doc is explicit: "Numeric values
  are assumed to be pixels. Strings without explicit units are assumed to be
  percentages." So the rail was silently clamped to a literal **40px**
  (`maxSize={40}` as pixels) on every launch — T11's whole "resizable file
  rail" feature was effectively broken (a barely-visible 40px sliver, not a
  22%-wide pane), and dragging the handle had no visible effect since the
  pixel-based max was already hit. Caught while writing T14's rail-resize E2E
  scenario: a throwaway Playwright script dumping `getBoundingClientRect()`
  and the Panel's own computed `flex-grow` inline style showed `4.489`
  instead of the expected `~22`, and `maxSize`'s value (40) matched the
  measured pixel width exactly — too specific to be a coincidence. Fixed by
  passing string percentages instead (`minSize="12%" maxSize="40%"
  defaultSize="22%"`, same for `chat`/`viewer`) in `WorkUI.tsx`; re-verified
  the rail now defaults to ~22% of window width and resizes properly up to
  the intended 40% cap. Per T14's own instruction ("debug real failures,
  don't weaken assertions") this was fixed in product code, not routed around
  in the test. Lesson for any future `ResizablePanel` usage in this codebase:
  always pass size props as `"NN%"` strings, never bare numbers.
- **T14 — Playwright MCP tools (`mcp__playwright__browser_*`) do not apply to
  this Electron app; they drive the MCP server's own separate Chromium
  instance with no path to the app's renderer (2026-07-12).** Verified live:
  `browser_navigate` to `about:blank` opens a normal page in the MCP's own
  managed browser context — there is no `connect`/`cdp-endpoint`-style tool
  in this session's Playwright MCP surface to attach it to an arbitrary
  external process's DevTools Protocol endpoint, and even if there were, this
  app's renderer only exposes `window.hive` via a `contextBridge` preload
  that a vanilla MCP-navigated tab (no Electron main process, no IPC) could
  never see — so "navigate to the app" isn't meaningful the way it is for a
  web app under test. Per context.md R-A's actual intent (validate visual
  behavior in the real running app, not assert blind), the correct
  Electron-native equivalent already in place is `_electron.launch` via
  `@playwright/test` (`e2e/*.spec.ts`) — same underlying Playwright engine,
  just its Node test-runner API instead of the MCP tool surface, and it's the
  only one of the two that can actually reach `window.hive`/the real
  BrowserWindow. T14's 8 new E2E scenarios (real DOM/on-disk assertions) plus
  a handful of throwaway `_electron.launch` scripts (bounding-box/computed-
  style dumps used to diagnose the rail-resize bug above, and
  `window.screenshot()` captures of the md-table/html-preview/multi-select/
  rail-resize states) serve as this feature's actual "Playwright MCP pass" —
  screenshots taken via the real Electron page object, not the MCP tool
  names, but the same evidence-gathering spirit. Worth flagging in any future
  Electron-app task that literally asks for "the Playwright MCP tools": they
  need `--remote-debugging-port` on the target app *and* an MCP server
  configured with a matching `--cdp-endpoint` to be useful there at all,
  neither of which is set up in this environment.

## Todos (cross-feature)

- **file-management (T1–T11) implemented on `main`.** Feature complete —
  create/edit/delete/rename/move/import, security, conflicts, coverage gate,
  E2E spec. The E2E spec (`e2e/file-management.spec.ts`) is correct but
  currently blocked from completing by the unrelated React-duplication crash
  above — re-run once that's fixed. ROADMAP M4 marked done.
- **explorer-editor-ux (M7, T1–T14) fully implemented on `main` (2026-07-12).**
  All 7 planned UX improvements shipped: edit-by-default + preview toggle,
  Ctrl+S + 3-way save-on-close dialog, rename/create commit-on-blur, Ctrl/
  Shift multi-select + bulk delete/drag-move, resizable+persisted file rail,
  `react-markdown`+`remark-gfm` table/task-list preview, sandboxed `.html`
  live preview. T14 closed the feature: `e2e/explorer-editor-ux.spec.ts`
  (new, 8 tests) covers open-by-default+Ctrl+S-save, close-dirty 3-way dialog,
  rename-via-blur, Ctrl-click bulk delete, Shift-click range select, rail
  resize persisted across a real app relaunch, `.md` table preview, and
  `.html` live preview (both app-driven "instant" reload and a real on-disk
  edit reloaded via reopen) — every scenario asserts the **on-disk** or real
  DOM/iframe result, not mocked state. Full suite green: `npm run build &&
  xvfb-run -a npm run test:e2e:app` → 10/10 (both E2E spec files); `npm run
  test` → 330/330 unit tests. `.specs/features/explorer-editor-ux/tasks.md`
  T1-T14 marked `[x]`.
- **workspace-switching (M8, T1–T10) fully implemented on `main`
  (2026-07-12).** VsCode-style in-app workspace switching shipped end to end:
  `ConfigStore` MRU (`recentWorkspaces` push/dedupe/cap-10/remove),
  `WorkspaceService` path-aware `provisionState`/`openWorkspace` (disk check
  of `_bmad/_config/manifest.yaml` per path, replacing the global
  `config.provisioned` flag for routing and fixing the latent
  already-provisioned-folder-reinstalls bug), IPC + preload bridge
  (`workspace:provisionState`/`workspace:recents`/`workspace:open`),
  `App.tsx` routing through `provisionState` plus a runtime re-entry into
  the onboarding gate (`handleSwitchWorkspace`, keyed `WorkUI` remount),
  `FileViewer`'s additive `onDirtyChange`, the `WorkUI` workspace-chip menu
  ("Abrir pasta…" + Recentes), and the three-way save guard + agent-session
  teardown wired end-to-end. T9's regression pass found the existing E2E
  specs needed their on-disk manifest fixture seeded, since routing now
  reads `_bmad/_config/manifest.yaml` directly rather than trusting the
  config flag. T10 closeout: `npm run test` → 389/389 unit/component tests
  green (21 files, no code changes needed); `npm run typecheck` clean;
  `npm run lint` shows 2 pre-existing `Explorer.tsx` errors
  (set-state-in-effect, lines 336/349) that predate this feature — from
  `explorer-editor-ux`'s T8 (commit `9fc0b344`, 2026-07-11) — left untouched
  per scope discipline; no new lint errors from this feature's own files.
  Per-file coverage confirmed ≥90% statements/branches/functions/lines on
  every T1-T9 touched file: `configStore.ts` (98.41/94.44/100/98.41),
  `workspaceService.ts` (100/100/100/100), `main/index.ts`
  (99.58/94.11/100/99.58), `preload/index.ts` (97.9/97.77/96.87/97.9),
  `App.tsx` (100/92.3/100/100), `WorkUI.tsx` (100/93.87/100/100),
  `Chat.tsx` (100/98.14/100/100), `agentService.ts` (100/95.45/100/100),
  `pt-BR.ts` (100/100/100/100) — no new `vitest.config.ts` per-file
  threshold entries were needed. T9's `e2e/workspace-switching.spec.ts` was
  already confirmed green in that task (`npm run build && xvfb-run -a npm
  run test:e2e:app`); not re-run in T10 since no code changed. ROADMAP M8
  marked Done; `.specs/features/workspace-switching/tasks.md` T1-T10 marked
  `[x]`. `spec.md` has no explicit per-requirement status markers (prose +
  Requirement IDs only) — left as-is.

- **chat-controls + agent-selection + role-personalization (D14–D16) IMPLEMENTED
  on `main` (2026-07-13).** All three feature areas shipped end to end:
  - **Main/IPC:** `configStore` gained `agent`/`role` (global); new
    `agentRegistry` (claude-cli available + devin placeholder) + re-bindable
    `agentService` (registry + `setAdapter`/`activeAgentId`); new `roleCatalog`
    (role→actions, verified skills + persona prompts); `workflowCatalog.listSkills`
    (full CSV skill list); `claudeCliAdapter`/`agentAdapter` `interrupted` event
    (user stop ≠ error); `main/index.ts` `profile:*` + `skills:list` handlers;
    `preload` `profile`/`skills` namespaces.
  - **Renderer:** required first-run **AgentSetup → RoleSetup** steps wired into
    `App.tsx`'s gate (skipped once set / on workspace switch); lifted `role`/`agent`
    state; personalized `IntentGrid` (role actions, persona set apart); persistent
    left `ActionRail` (fixed chrome column outside the resizable body); `ProfileSheet`
    (DS Sheet, role+agent, live); `Chat` interrupt Stop + `interrupted` handling +
    `SlashMenu` (`/`-triggered, keyboard, `aria-activedescendant`) + agent indicator
    + session re-bind on agent change; shared `ChoiceCard`/`ChoiceGrid` radiogroup;
    `roleVisuals` icon map; ~16 new icons; all copy in `pt-BR.ts`; styles in
    `workbench.css` (product register, dark+light, reduced-motion).
  - **Gates:** `npm run test` → 430/430 (23 files); `npm run typecheck` clean;
    `npm run build` clean; `npm run lint` shows only the 2 pre-existing
    `Explorer.tsx` set-state-in-effect errors (from explorer-editor-ux T8) — no
    new errors from these features' files; per-file coverage ≥90% held on every
    gated file (index, preload, pt-BR, icons, WorkUI, Chat).
  - **Visual pass:** `_electron.launch` (throwaway userData + seeded workspace)
    captured the AgentSetup, RoleSetup (dark+light, +selected), the personalized
    work-UI hero + action rail, and the profile sheet — all render correctly
    on-brand in both themes (`test-results/personalization-screenshots/`). The
    app reached the real work UI end to end (agent+role set → provisioning →
    hero+rail+"Conversar com John"+"● Claude Code" indicator). Playwright **MCP**
    tools still can't reach this Electron renderer (STATE.md T14) — used the
    Electron-native `_electron.launch` path, same engine.
  - **NOT committed:** left on the working tree (uncommitted) because the tree
    already carried unrelated in-flight work (the `InstallConfigForm`/guided-install
    "BUG 1" feature) entangled across shared files — committing cleanly per-task
    was infeasible without sweeping that in. Commit decisions deferred to the user.
  - **`tasks.md` for all three features marked `[x]`.**

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
