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

- **D20 — Feature `npm-distribution` (M6 slice).** Planned 2026-07-21
  (spec/context/design/tasks in `.specs/features/npm-distribution/`). Publish to
  the public npm registry under the user's personal scope + in-app self-update
  sourced from that registry. Discuss decisions (context.md):
  (ND-C1) **npm is both the version source AND the payload host** — no external
  release server. Three verified constraints shaped it: jsDelivr/unpkg cap files
  at **20–50 MB** so a ~92 MB installer *cannot* be CDN-served (we use the raw
  `registry.npmjs.org/<pkg>/-/<pkg>-<v>.tgz` URL, which is uncapped); npm's hard
  limit is the **100 MB packument** (metadata, accumulating per version), so
  binaries go in **separate per-platform packages** (esbuild/swc pattern) and the
  main package stays metadata-light; and `electron-updater` **cannot consume npm**
  — its `Provider` (`getLatestVersion`/`resolveFiles`) downloads the resolved URL
  as a **raw installer + sha512**, and an npm tarball is a `.tgz` wrapper.
  (Confirmed in the installed `electron-updater@6.8.9`: `provider:"custom"` with
  an injectable `updateProvider` **does** exist — it covers discovery but not the
  `.tgz` unwrap, so it buys nothing here.)
  (ND-C2) public **scoped** package `@<npm-user>/hive-desktop` + sibling
  per-platform packages; public is a *hard requirement* — a private package needs
  a client auth token and a desktop app can't ship the user's npm credentials.
  Both `hive-desktop` and `@gustavobgt/hive-desktop` verified free (HTTP 404).
  (ND-C3) discovery is automatic, **consent never is**: non-blocking notice,
  refusable ("Agora não" = session), skippable per-version (persisted in
  `ConfigStore.skippedUpdateVersion`, never re-nagged), nothing downloaded or
  applied without an explicit action. User requirement, verbatim.
  (ND-C4) payload = the **full ~92 MB platform installer**, not a hot-swapped
  bundle. Measured: `out/` is only **4.2 MB** vs **284 MB** of Electron runtime,
  so a 4 MB "light" update was tempting but **rejected** — it can't update
  Electron/native deps and collides with **asar integrity validation (Electron 39)
  + macOS code signing**, which would force loading app code from `userData`.
  (ND-C5) the existing `UpdateService`/`UpdateEvent`/`AppInfo` **contract is kept**
  and only extended (`verifying`/`applying` events, `error.kind`, `bytes`/`notes`,
  `canApply`, `lastCheckedAt`, `cancel()`); only the backing changes, so
  IPC/preload/renderer don't churn. `electron-updater` is removed, retiring the
  mandatory `vi.mock('electron-updater', …)` trap in `main/index.test.ts`.
  (ND-C6) **Windows/NSIS is the only implemented apply path in v1** (the user's
  platform), behind a strategy interface; other platforms stop at `downloaded`
  and offer a manual reveal (`canApply:false`) rather than failing silently.
  Registry protocol: `GET /<pkg>/latest` (not the packument — the abbreviated
  form strips custom fields) carries version + a custom `hiveRelease` field with
  release notes + platform map; scoped names need `%2F` encoding. New deps `tar`
  + `semver`; sha512 verified with `node:crypto` (no `ssri`). UI shaped with
  `impeccable` product register on the DS's committed tokens (D16
  identity-preservation path — `context.mjs` still reports NO_PRODUCT_MD):
  three tiers — ambient `--accent` dot on the rail gear (the "declining never
  strands you" guarantee) → **`UpdateNotice` composed from DS Toast primitives**
  (`duration={Infinity}`, bottom-left above the gear, morphs in place across
  available/downloading/verifying/downloaded/error with reserved height) →
  `UpdateCenter` (redesigned `AppSettingsSheet`). Explicitly **no modal**.
  (2026-07-21)

- **D38 — Quatro melhorias de UI (2026-09-02).** Pedidos do usuário, sem
  milestone própria. Decisões que não são óbvias no código:
  (a) **A barra de rolagem do painel de modelos é consertada no design system**,
  não no app: a regra global do `workbench.css` já recoloria toda barra, e o
  `.hds-picker-list` se auto-excluía com `scrollbar-width: thin` (ver Lessons).
  O DS ganha as regras `::-webkit-scrollbar-*` próprias para que o Storybook
  mostre a mesma coisa que o app.
  (b) **O Estúdio passa a usar os controles do composer, não cópias deles** —
  `AgentSwitcher` + `EnginePicker`, com `onManage` opcional (um Dialog não pode
  abrir a folha de perfil sem destruir o rascunho).
  (c) **O item "amend" usa `indicator="trailing"`** para alinhar as duas linhas
  do menu do commit à esquerda.
  (d) **Os logs do Git são um dock, irmão do console MCP, mutuamente exclusivo
  com ele** — dois docks empilhados não deixariam área de trabalho. O registro
  vive em `main/gitCommandLog.ts` (buffer limitado, 500 entradas), alimentado
  por um `onCommand` injetado no `GitService`, e é lido por
  `git.logs.history()` + `git.logs.onEntry()`. Linhas estruturadas, não um
  despejo de texto (PRODUCT.md), com "Copiar tudo" produzindo o texto plano que
  vai para um issue.

## Lessons (quatro melhorias de UI: barra de rolagem, controles do Estúdio, menu do commit, logs do Git — 2026-09-02)

- **A declaração que desliga o tema da barra de rolagem.** O painel de modelos
  do chat exibia a barra crua da plataforma — trilho claro na borda de um
  popover escuro — enquanto todo o resto do app usa a barra recolorida por
  `body ::-webkit-scrollbar`. A causa é uma linha que parece a coisa certa:
  `scrollbar-width: thin` no `.hds-picker-list` do design system. No Chromium,
  um valor não-`auto` em `scrollbar-width` (ou `scrollbar-color`) faz o elemento
  entrar no caminho padrão e **ignorar todas** as regras `::-webkit-scrollbar-*`
  que chegariam nele. A declaração escrita para deixar a barra discreta é
  literalmente a que a deixou estrangeira. Três lugares tinham a linha (o DS e
  dois scrollers do console MCP); os três voltaram para a barra tokenizada, e a
  regra global do `workbench.css` agora proíbe a declaração pelo nome. Medido no
  navegador: `CSS.supports('selector(::-webkit-scrollbar-thumb)')` é `true` no
  Chromium, então o fallback do Firefox pode ficar atrás de um `@supports not`
  sem risco de o Chromium cair nele.

- **Dois vocabulários para a mesma decisão é uma escolha, e era a errada.** O
  modal "Nova skill"/"Novo agente" coletava agente + modelo + esforço com
  cartões de rádio e dois `Select` rotulados "Modelo" e "Esforço" — enquanto o
  composer do chat já tinha o `AgentSwitcher` e o `EnginePicker`. Não era só
  inconsistência visual: os `Select` eram estritamente mais pobres (lista chata
  de ids, sem tiers, sem descrição, sem janela de contexto, sem procedência) e a
  escada de esforço em seis palavras punha a ordenação inteira no conhecimento
  prévio do leitor. Importar os controles reais apagou ~120 linhas de UI e de
  CSS e é o que impede a deriva na próxima vez que o composer aprender algo.
  A única diferença deliberada: `onManage` virou opcional, porque dentro de um
  Dialog o "Gerenciar agentes…" só poderia ser honrado fechando o estúdio — e
  jogando fora o briefing sendo digitado.

- **O `space-between` do M20 tinha um irmão.** O `DropdownMenuCheckboxItem` do
  DS reserva 20px à esquerda para a marca; o `DropdownMenuItem` ao lado não
  reserva nada. Num menu que mistura os dois — o do botão de commit — as duas
  linhas ganham duas margens esquerdas diferentes, e "Corrigir último commit
  (amend)" lia como erro de renderização. `indicator="trailing"` põe a marca na
  borda oposta e devolve uma única margem. Não é um defeito do DS desta vez: a
  calha existe para alinhar rótulos **entre linhas marcáveis**; o custo aparece
  só quando um menu mistura as duas famílias, e é o consumidor que sabe disso.

- **O harness visual envelhece em silêncio, e a falha é uma página em branco.**
  O `boot.mjs` ainda mockava `window.hive.whisper`, que o M29 substituiu por
  `asr`. Resultado: `createAsrClient` lê `onPhase` de `undefined` e derruba a
  árvore inteira do React — tela branca, zero mensagem visível, o único sinal no
  `pageerror`. Um passe visual que abre em branco deve fazer o agente suspeitar
  do mock antes do app. Registrado em `docs/visual-validation.md`; o mock
  também ganhou o `git` de verdade (o antigo dizia `isRepo: false`, então
  **nenhum** passe podia olhar o painel de Controle de versão — ele renderizava
  o estado "inicializar repositório" e o defeito do alinhamento do menu era
  literalmente inalcançável pela receita do repositório).

- **O console de git é sobre a sequência, não sobre o erro.** O `GitService` já
  mostra o stderr do comando que falhou (D-GIT-1). O que faltava é o que quase
  toda pergunta difícil de git realmente é: *este* `push` falhou mas *aquele*
  `fetch` funcionou; este `status` respondeu por um diretório que ninguém
  esperava; o painel ficou quieto quatro segundos e nada deu erro. Por isso o
  registro fica em **main** (a janela é assinante, pode não existir ainda e pode
  ser trocada por um reload) e a assinatura é aberta **antes** da leitura do
  histórico — um comando que termina entre as duas chamadas passa a chegar duas
  vezes em vez de nenhuma, e a de-duplicação por id resolve o resto.

- **Um dublê que engole a prop torna a regressão indetectável por construção.**
  O mock do `DropdownMenuCheckboxItem` no teste do `CommitBox` descartava
  `indicator` — exatamente a prop que decide o alinhamento que o usuário
  reportou. Nenhum teste poderia ter pego o defeito enquanto o dublê fosse esse.
  Agora ele expõe a prop como atributo, e há uma asserção sobre ela.

## Lessons (crash no processo principal ao fechar o app — 2026-08-31)

- **A janela que morre sem se despedir.** O usuário reportou o diálogo "A
  JavaScript error occurred in the main process" **depois** de fechar o Hive:
  `TypeError: Object has been destroyed` em `WebContents.send`, chamado de
  `FSWatcher.handleRawEvent`. Toda stream main → renderer daqui é uma assinatura
  por sender desmontada por um `:stop` explícito do renderer — e uma janela
  fechada nunca manda um. O watcher do workspace sobrevive à janela e o próximo
  evento de inotify chama `send` num objeto destruído, dentro de um callback
  nativo sem `try` acima: exceção não capturada no processo principal.
- **Guardar o `send` não basta; a assinatura tem que morrer junto.** A correção
  tem duas metades em `index.ts`: `sendTo` (nunca tocar um WebContents
  destruído — sem corrida, main é single-threaded) e `whenSenderGone` (roda o
  próprio teardown da stream no evento `destroyed` do sender, com chave por
  stream, para que um start repetido substitua o teardown em vez de empilhar um
  obsoleto). Aplicado às nove streams: `fs:watch`, `git:changed`,
  `review:changed`, `agent:event`, `bmad:install`/`update`, as streams do
  Second Brain/Design Studio, `mcpLogs:watch`, `agents:install` e
  `update:event`. Os watchers de review são chaveados por **workspace**, não
  por janela — esses saem no `before-quit`.
- **A exceção não mata o processo: ela o trava.** Medido no app real (E2E
  `window-close-teardown.spec.ts`, build pré-correção): depois da janela
  destruída e de uma escrita no workspace, `app.evaluate` **nunca responde** —
  o Electron para tudo no diálogo de erro. Então "main continua respondendo" é
  o sinal do teste, não o stderr: o Playwright é dono daquele pipe e o
  `app.process().stderr` chega vazio.
- **`process.getActiveResourcesInfo()` mede o watcher.** Um `fs.watch`
  recursivo aparece como N × `'FSEventWrap'` (um por diretório; 9 no workspace
  semeado, 150 em `src/main`). Isso torna "o watcher morreu junto com a janela"
  uma medição, não uma inferência — as duas asserções falham no build
  pré-correção e passam no pós.
- **Fakes de teste que não modelam o objeto real escondem a classe do bug.**
  Os `{ id, send }` do `index.test.ts` não tinham `isDestroyed` nem `once`, ou
  seja, nenhum teste podia sequer expressar "a janela fechou". Agora todos usam
  `fakeSender(id)`, que carrega as duas coisas e um `close()` que executa o
  listener de `destroyed`.

## Lessons (four fixes: reload, discard contrast, modal centring, checkout — 2026-08-31)

- **Um centro feito de porcentagem envelhece.** O `DialogContent` do DS centrava
  com `top/left: 50%` + `translate(-50%, -50%)`. Porcentagem em `translate`
  resolve contra o **tamanho da própria caixa** — e todo diálogo que carrega
  lista (Estúdio, MCP, branches) abre pequeno e cresce. Medido no navegador: o
  Estúdio abre com 145px (cabeçalho + spinner) e assenta em 592px; o translate
  vai de −72,5px para −296px. A thread principal refaz a conta; um compositor
  que já fotografou o transform animado, não — e o painel pinta ~metade do
  próprio crescimento abaixo do centro, com o rodapé cortado pela borda da
  janela. **Intermitente por construção**: depende de os dados chegarem antes ou
  depois de a animação de abertura ser commitada. A correção é centrar por
  layout (`inset: 0` + `margin: auto` + `height: fit-content`) e animar só
  `scale`. `height: fit-content` é carga estrutural, não enfeite: com `top` e
  `bottom` em 0 e altura `auto`, o CSS resolve para a *altura* e o diálogo
  ocuparia a janela inteira.

- **`getBoundingClientRect` não enxerga esse defeito** — ele lê o layout da
  thread principal, que está certo. A sonda tem que provar a *propriedade* ("não
  existe porcentagem no transform de uma caixa que muda de tamanho depois de
  aparecer"), não medir a instância. E a cena precisa conter o crescimento: um
  fixture que resolve a lista na hora nunca reproduz nada.

- **`--danger-ink` não é tinta para o `--danger` preenchido.** Terceira
  reincidência da mesma família (M22 foi `--accent-ink` sobre `--selected-bg`):
  `.wb-btn-danger` pintava `--danger-ink` sobre `--danger`, que é o mesmo
  vermelho sobre o mesmo vermelho — **1,31:1 no escuro, 1,04:1 no claro, 1,33:1
  no hive**. O botão "Descartar" estava no DOM e não na tela. O par que faltava
  agora existe: **`--danger-fill-ink`** (`design-system/src/tokens.css` + o bloco
  `hive` de `assets/theme.css`), medido em 5,04 / 6,54 / 5,04. A regra
  generalizável: em toda família de cor, `X-ink` é tinta para o **tint**
  (`X-bg`); tinta para o **preenchimento** é um segundo papel e precisa de um
  segundo token — e o sinal de que ele não existe é a tinta e o fundo saírem do
  mesmo `oklch`.

- **Recarregar é do main, não do documento.** `location.reload()` no renderer
  re-executa a SPA dentro do mesmo processo e preserva justamente o estado que
  motivou o recarregamento. `app:reload` chama `reloadIgnoringCache()` na janela
  **do remetente** (`BrowserWindow.fromWebContents(event.sender)`), não na
  focada: o foco pode ter mudado enquanto o IPC estava no ar. E em build
  empacotado o acelerador Ctrl+R do menu do Electron já não existe
  (`optimizer.watchWindowShortcuts`), então sem o handler do renderer a memória
  muscular não faz nada.

- **Checkout é operação local; o menu de estouro do SCM estava atrás de
  `remote`.** Um repositório sem remoto não mostrava menu nenhum — e é
  exatamente onde trocar de branch continua fazendo sentido. Só o grupo remoto é
  condicional agora.

## Lessons (voice-models, 2026-08-23)

- **"O download falhou" was, in part, a progress bar that did not move.** The
  store emitted progress once per *file*, and the model the user reported
  (`medium`) is two files. Twenty-odd minutes at 0 %, one jump to 42 %, then
  silence. Before hunting a network bug, check whether the UI is *capable* of
  showing the work happening — a user cannot distinguish a stalled transfer from
  a stalled readout, and will report the one they can name.
- **Whatever outlives the surface that started it does not belong to that
  surface.** A hook held the download's only handle, so its unmount cleanup was
  the cancel. Every long job — a download, an install, an upload — wants an
  owner in main and a *subscriber* in the renderer. The test that pins this is
  worth writing explicitly: "unsubscribing stops watching and never cancels".
- **A nullable field is a design decision, not a type change.** Making
  `WhisperPreference.id` nullable is one line; the work is that every surface
  which listens now has to answer "and what do I do with nothing?" — the
  composer's mic, the ingestion sheet's two audio sources, the profile index
  row, the auto-resolution ladder. That rippling is the *point*: it is what
  stops a fresh install from offering a microphone that can only fail.
- **The HF tree API pages at 50.** `whisper-medium` ships 31 files under
  `onnx/` alone, and a repo with more would have pushed the two files we
  actually want off the first page — surfacing as "no fp32 weights published
  for this model" for a model that has them. Always ask for the page you need.
- **A fixture that keeps only the newest subscriber is a broken broadcast.**
  `boot.mjs` overwrote `window.__downloadSettled` on every `onDownloadSettled`
  call, so the moment the model gate mounted, the app-wide notice stopped
  receiving — and the probe waited thirty seconds for a card nobody had been
  told to render. The mock must have the same fan-out shape as main, or it
  silently tests a different app.
- **Two probe traps, both "a state the component never rendered":** the profile
  sheet reads its catalog when *the sheet* opens, not when the scope changes, so
  the empty library needs a close-and-reopen rather than a "back"; and a fixture
  planted with `page.evaluate` is wiped by the next `reload()`, so anything a
  reload has to survive belongs in `addInitScript`. Both produced clean-looking
  `missing` reports rather than errors, which is exactly why the probes report
  `missing` separately from `failures`.
- **Playwright refuses to screenshot a 340×0 element.** The shared notice column
  is always mounted (it also holds the update notice) and has no height while
  empty. Photograph the card, not its container.
- **A picker that reshapes the form under it earns cards over a dropdown.** The
  Estúdio's agent choice changes which *fields* exist (Copilot has no effort),
  and a `Select` collapsing a field below itself reads as a glitch. Model and
  effort stay dropdowns because they only change a value.

## Lessons (npm-distribution — real publish attempt, 2026-07-22)

- **T1's spike verified the download side of the registry assumptions but
  never the upload side — and the upload side is what actually failed.**
  General lesson beyond this feature: when a design leans on "the registry
  has no cap" (or any claim about a boundary you haven't personally pushed
  on), a spike that only exercises the *read* path doesn't actually retire
  that risk — it just tests the half that was never in doubt. If the real
  risk is in an action you're about to take for the first time ever (a real
  publish, a real large upload), the spike needs to attempt *that specific
  action* at realistic scale, not a nearby read-only proxy for it. See D21
  (STATE.md Decisions) for the full account — npm's real per-tarball limit
  (undocumented anywhere) rejected a genuine ~297 MB publish with `413`.
- **A second `build:win` on top of an already-populated `dist/` silently
  doubled the installer size (297 MB → 594 MB), which then made the real
  `npm publish` crash with `ERR_STRING_TOO_LONG`** before ever reaching the
  size-limit issue above. `electron-builder` does not fully replace its
  previous `dist/win-unpacked` output on a second consecutive build without
  a wipe first — traced to `resources/app.asar.unpacked` growing rather than
  being overwritten. Fixed by having `scripts/release.mjs` `rm -rf out/ dist/`
  at the start of every build, unconditionally — a release script must never
  depend on the working directory happening to be pristine to produce a
  correct artifact. Caught before any bad data reached the registry (the
  crash was local, in npm's own payload-construction step) — but it's a
  reminder that "the last build looked right" isn't a guarantee the next one
  will, for any packaging tool with its own incremental/cache behavior.
- **`scripts/release.mjs`'s dirty-tree gate ran a repo-wide `git status`, not
  scoped to the package being released, and blocked a release on unrelated
  monorepo clutter it had no business caring about.** In this monorepo, a
  release of `hive-desktop/` was blocked by uncommitted files at the repo
  root belonging to neither this feature nor this package. Fixed by scoping
  the check to `.` (relative to the script's own `ROOT` = `hive-desktop/`).
  General lesson for any release/CI script in a monorepo: scope dirty-tree
  and similar "is it safe to release" checks to the actual release unit, not
  the whole repo, unless a cross-package release genuinely requires it.

## Lessons (npm-distribution T1 spike)

- **T1 — all four registry assumptions confirmed against the real, live
  `registry.npmjs.org` (2026-07-21), no fallback needed.** Probed with public
  packages (not the still-unpublished `hive-desktop`): (a) `GET /<pkg>/latest`
  (e.g. `react`) returns the **full** version object (21 keys incl. internal
  `_npmUser`/`_nodeVersion` fields) — confirmed distinct from the stripped
  abbreviated form. (b) **Custom top-level `package.json` fields survive
  publication** — verified with `np` (`ava`, `xo` preserved), `semantic-release`
  (`ava`, `c8`, `lockfile-lint`, `prettier`, `renovate` preserved) and the
  **scoped** `@semantic-release/npm` (same fields preserved) — so design.md's
  `hiveRelease` custom field will round-trip as designed; the stated fallback
  (`hive-update.json` inside the platform package) is **not needed**.
  (c) `dist.tarball` + `dist.integrity` are both present and the tarball is
  fetchable with a plain unauthenticated `curl`; downloaded `react-19.2.8.tgz`
  hashed with `node:crypto` sha512 matched `dist.integrity` **byte-for-byte**.
  (d) Scoped names: tested `@angular%2Fcli` alongside the literal unencoded
  `@angular/cli` in the URL path — **both returned HTTP 200 with identical
  JSON**, so `%2F` encoding is not strictly enforced by the registry itself
  (contrary to design.md §2's phrasing that it's "needed"). Decision: still
  **always URL-encode** (`%2F`) in the implementation regardless — it's the
  technically-correct form, costs nothing, and avoids relying on undocumented
  registry leniency that could tighten later.

- **D21 — SUPERSEDES D20's payload mechanism: GitHub Releases replace the
  per-platform npm package (2026-07-22).** The first real `npm publish` of
  the Windows platform package (after ND-B1 resolved) failed with a genuine
  `npm error code E413 — 413 Payload Too Large` from the live registry —
  confirmed clean, nothing published (both package names verified still 404
  immediately after, twice). D20/ND-C1's "the raw registry tarball URL has no
  such cap" was an **untested assumption** — T1's spike only verified
  *downloading* a small existing package, never *uploading* a large one; this
  was the first real exercise of that assumption and it failed on the first
  attempt. Compounding: the real installer is **~297 MB**, not the ~92 MB
  ND-C4 was sized around — `@anthropic-ai/claude-code` (added by a later,
  unrelated feature) bundles the full Claude CLI binary (~250 MB alone).
  **User decision:** keep npm as the version source (unchanged, works exactly
  as designed) but move the payload host to a **GitHub Release** on
  `gustavobrunodev/hive` — design.md's own pre-approved fallback, chosen over
  chasing npm's real (undocumented, possibly moving) limit. Verified live
  before committing to it: unauthenticated `GET /repos/<repo>/releases/tags/
  <tag>` works with no token for a public repo (60 req/hour, ample for a
  45-min periodic check); a real `electron/electron` release asset at 1.86 GB
  confirms GitHub's ~2 GB ceiling has enormous headroom. Full technical
  design in design.md §2A (marked as superseding §2-§4's original npm-package
  mechanism, not deleted — the original was correctly implemented and *did*
  work end-to-end via `--dry-run`; it just can't survive contact with the
  real registry's actual upload limit). New blocker: ND-B2 below. Requirement
  IDs ND-R1.3/R3.1/R3.3/R4.1 in spec.md are marked superseded in place (same
  pattern) rather than rewritten, to keep the "this was tried, here's why it
  changed" record intact for whoever reads this next.
  **Implemented 2026-07-22 (T20-T23, T25):** new `main/githubReleases.ts`
  (`fetchGithubPayload`, same DI shape as `npmRegistry.ts`); `updateDownload.ts`
  simplified to `downloadAndVerifyInstaller` (no more `tar` extraction — the
  `tar` dependency was removed, confirmed unused elsewhere); `updateService.ts`
  rewired (one `registryClient` now covers both npm and GitHub, since both are
  just "fetch a URL, parse JSON" — a `User-Agent` header was added since
  GitHub's API requires one); `package.json`'s `hiveRelease` gained `repo`, and
  `platforms['win32-x64']` now names an asset file, not an npm package;
  `scripts/release.mjs` replaced the assemble+`npm publish`-platform-package
  step with real GitHub Release create/reuse + asset upload logic (idempotent
  re-runs verified via a pure `decideReleaseAction` helper; confirmed live —
  no token needed — that `gustavobrunodev/hive`'s `v0.1.0` tag does not exist
  yet). Full suite green: 918/918 tests, typecheck/lint clean, every touched
  file ≥90% coverage (`githubReleases.ts` 100/97.36/100/100, `npmRegistry.ts`/
  `updateDownload.ts` 100/100/100/100, `updateService.ts` 100/97.33/100/100) —
  zero new regressions versus the pre-pivot baseline (the same pre-existing
  gaps in `Explorer.tsx`/viewers/`Chat.tsx`/`preload/index.ts`, from the
  unrelated multi-agent/file-viewer features, are unchanged). `--dry-run`
  confirmed working end-to-end with no `GITHUB_TOKEN` (only the real,
  non-dry-run path needs one — ND-B2). `tasks.md` T20-T23/T25 marked `[x]`;
  T24 (the actual authenticated publish) remains the only open item, blocked
  on ND-B2 exactly as planned.

- **D22 — Feature `git-management` (new milestone M10 — Source Control).**
  Planned 2026-07-23 via tlc-spec-driven (spec/context/design/tasks in
  `.specs/features/git-management/`). Complete in-app git, VS Code/Cursor
  parity. Locked gray-area decisions (context.md, from the user's
  `AskUserQuestion`): **(D-GIT-1) remotes use system credentials only** — git's
  own credential helper/SSH; Hive never prompts for or stores a token, builds no
  credential UI, and surfaces git's real stderr on auth failure (`GIT_TERMINAL_
  PROMPT=0`, fail-fast); **(D-GIT-2) switchable sidebar (VS Code style)** — the
  `ActionRail` becomes an activity bar switching the left rail body between
  Explorer and Source Control (rail keeps `id="rail"` so `hive.workLayout`/
  `paneOrder` are untouched), `Ctrl/Cmd+Shift+G` opens SCM; **(D-GIT-3) full P1
  scope** — the user chose **all four** advanced buckets for P1: commit history
  (timeline + per-file), merge conflict resolution, stash, and explorer
  decorations + editor gutter, on top of the core loop (status/stage/discard/
  commit/branches/diff/sync/init). Agent's-discretion decisions (design.md):
  **git CLI via the existing `processRunner.ts`** (not simple-git/isomorphic-git
  — same CLI pattern as BMAD/Claude adapters, `git` present at 2.34.1, machine
  formats `--porcelain=v2 -z`/`--format` with pure fixture-tested parsers in
  `gitParse.ts`); new app-local `DiffView` + `StatusBar` + `ConflictView`
  components (`CodeBlock` is not a diff renderer); tree decorations via the DS
  `Tree`'s existing `renderLabel` (no DS change needed); gutter via `fast-diff`
  (already in node_modules) off the keystroke path; per-repo serial mutation
  queue for index safety. Same quality gates as prior features: no regression,
  ≥90% per-file coverage, real-repo+bare-remote E2E, Playwright-MCP visual pass
  (dark+light, every state), all copy pt-BR via `t()`. Deferred to P2/P3:
  per-hunk staging, gutter hunk revert, revert-commit/cherry-pick, tags, branch
  compare/graph, blame, provider/PR integration, multi-repo. (2026-07-23)

- **D23 — Feature `agent-change-review` (new milestone M11).** Planned 2026-07-24
  (spec/context/design/tasks in `.specs/features/agent-change-review/`). A
  Cursor/Claude-Desktop-style flow to review the agent's file changes and
  accept/reject them. Gray-area decisions (context.md, from the user via
  `AskUserQuestion` 2026-07-24):
  (ACR-C1) **Apply model = optimistic (apply + revert).** `claude` keeps writing
  to disk (`--permission-mode acceptEdits` unchanged); "review" = keep or revert
  against a pre-turn checkpoint (the Cursor mental model). A **gated/pre-approval**
  model (hold writes via a Claude Code `PreToolUse` hook) was evaluated and
  **rejected** — it changes the execution model, fights `acceptEdits`, and is
  Claude-hook-specific. Consequence: the checkpoint is load-bearing and must be
  race-free + always recoverable until explicit accept.
  (ACR-C2) **Capture = app-managed, git-independent snapshots.** Concrete
  realization (design's call, honoring the intent): a **shadow-git checkpoint
  store** — a private `GIT_DIR`/`GIT_INDEX_FILE` under `userData/checkpoints/
  <sha1(ws)>/` with the workspace as `GIT_WORK_TREE`, used purely as a fast,
  incremental, race-free snapshot + diff engine (reuses git's hashing + `gitParse`
  for free), **invisible to and independent of the user's `.git`** and working
  even in non-repo folders. `info/exclude` (node_modules/.git/dist/out/coverage/
  .playwright-mcp) + the workspace `.gitignore` keep snapshots cheap; reviewable
  artifacts (`_bmad-output`, docs) stay visible. Chosen over the literal per-file
  `git diff --no-index` because **pre-images must be captured before the write**,
  and the only race-free adapter-agnostic source is a turn-start whole-tree
  baseline (lazy FS-watcher capture is inherently racy — the event arrives after
  the write). The **user's git working tree was rejected** as the basis — it would
  require a repo and conflate the user's uncommitted edits with the agent's. git
  is already a hard dep (M10). Capture is **adapter-agnostic** (observes the FS).
  (ACR-C3) **Surface = tiered** — inline editor diff w/ per-hunk ✓/✗ (Cursor tier,
  on the M10 gutter), in-chat change card per turn (Claude Desktop tier), a
  persistent "N pendentes" review bar, and a switchable "Revisão do agente"
  sidebar view (sibling of Source Control via `SidebarHost`) — all over one
  pending set (single source of truth).
  Derived (design's, not separate user inputs): (ACR-C4) granularity = hunk+file+
  set (per-hunk revert via reverse-applying the parsed hunk's patch); (ACR-C5) one
  **accumulating** pending set per workspace = `diff(baseline → work-tree)`, accept
  advances the baseline, reject restores it; (ACR-C6) shaped with `impeccable` +
  validated in the Playwright MCP (dark+light); (ACR-C7) Claude `tool_use`
  attribution is best-effort **enrichment/plumbing only** in v1, never the capture
  basis. New main `CheckpointService` + `ReviewService` + `review:*` IPC; new
  renderer `useReview` store + `InlineAgentDiff`/`ChangeCard`/`ReviewBar`/
  `AgentReviewPanel` + `HunkActions`; `DiffView` extended with per-hunk actions.
  Reuses M4 STALE + M8 unsaved-guard. Same gates as prior features (no regression,
  ≥90% per-file coverage on non-UI files, `_electron.launch` E2E asserting on-disk
  accept/reject, Playwright-MCP visual pass, pt-BR via `t()`). Deferred to P2/P3:
  gated pre-approval, multi-turn undo stack, semantic diffs, inline edit-before-
  accept, rename pairing, auto-commit. Implement on a new `feat/agent-change-review`
  branch. (2026-07-24)
  **DONE 2026-07-25** — all 25 tasks (T1–T25) shipped as atomic commits on
  `feat/agent-change-review` (branched off `feat/git-management`/M10, **not yet
  merged** — M10 itself isn't merged, and M11 builds on its `DiffView`/`gitParse`/
  gutter/`SidebarHost`). `npm run verify` green: typecheck + **0 lint errors** +
  **1299** unit/component tests. Every changed non-UI file ≥90/90/90/90
  (`checkpointService`, `reviewService`, `gitParse`, `main/index`, `preload`,
  `cliAdapterCore`, `useReview`, `inlineDiff`, `gitStatus`, `HunkActions`,
  `DiffView`); the large renderer shells (`AgentReviewPanel`, `InlineAgentDiff`,
  `ChangeCard`, `ReviewBar`, `WorkUI`, `Chat`) follow the SkillStudio/McpManager
  gating precedent. Real-Electron E2E (`e2e/agent-change-review.spec.ts`) passes
  under xvfb (surface smoke: view switch + empty state + `review.get` over real
  IPC); the on-disk **accept keeps bytes / reject restores bytes / reject-all
  restores all** round-trip is asserted authoritatively against **real git** in
  `reviewService.test.ts` — the turn checkpoint (`beginTurn`) can't be driven
  deterministically in the sandbox (no agent CLI; the error-path `endTurn` races
  file writes), the E2E instability the design's R3 anticipated. Visual: 10
  Playwright-MCP screenshots under `.playwright-mcp/review-{dark,light}-*.png`
  (panel, inline diff, card ±expanded, bar, empty, reject-all confirm, STALE) —
  every state legible + first-party in both themes.
  **OQ4 resolved:** the undo-accept toast (ACR-R4.2) is **deferred to a
  follow-up** rather than faked — our accept is *immediately final*
  (`advanceBaseline`/`snapshot` commits the new baseline tree at once, no deferred
  window), so a real "undo" would need retaining the pre-accept baseline; reject
  is already fully recoverable via the pending set, and the keyboard flow
  (ACR-R4.1, A/R/J/K on `InlineAgentDiff`) shipped.
  **Lessons:** (1) the vitest suite's `include` is `**/*.test.ts` only —
  `.test.tsx` files silently never run; write React component tests as `.test.ts`
  with `createElement`. (2) A component exercised through two import paths (direct
  test + transitively via a parent) mis-merges in v8 per-file coverage across
  workers — co-locate its unit tests in the same file that renders it transitively
  (moved `HunkActions` tests into `DiffView.test.ts`). (3) `npm run typecheck`
  uses `--composite false`; a bare `tsc -p tsconfig.web.json` floods false
  `TS6307` project-boundary errors — always use the npm script. (4) Renderer must
  not import `src/main/*` (composite boundary) — derive types from the
  `window.hive` global (`gitStatus.ts`/`reviewTypes.ts` pattern), and keep the
  preload `.d.ts` importing only pure type modules (split `reviewTypes.ts` out of
  `reviewService.ts` so it doesn't drag `checkpointService`/`fs` into the web
  program). (5) `verify` does **not** run `test:coverage`; pre-existing coverage
  debt (Chat.tsx 88.98% branches in untouched composer/mention code; the M7
  explorer viewers) is real but out of scope and unchanged by M11. (2026-07-25)

- **D24 — Feature `second-brain` (new milestone M12).** Planned 2026-07-25,
  shipped 2026-07-26 on `feat/second-brain` (branched off
  `feat/agent-change-review`/M11, **not yet merged** — M10/M11 aren't merged
  either, and M12 builds on M11's `SidebarHost`/`launchAction` and M10's
  `FileTree`). A squad knowledge base (Markdown vault in the workspace, git-
  versioned) fed by typed, pasted or **spoken** material and filed into a wiki
  by the `second-brain` agent skill. Locked gray-area decisions (context.md,
  from the user via `AskUserQuestion` 2026-07-25): **D-SB-1** Whisper via
  Transformers.js (WASM/WebGPU) rather than whisper.cpp — zero native toolchain,
  no ffmpeg (WebAudio decodes/resamples); **D-SB-2** the vault lives at
  `<ws>/second-brain/`, committed and shared, one per repo; **D-SB-3** P1 =
  floating ingestion FAB **plus** a management sidebar view (query/lint launch
  into the chat; a rendered answer surface is P3); **D-SB-4** no model in the
  installer — download on demand, `base` first. Derived (design's): **D-SB-5**
  ingestion = write to `raw/` then launch `/second-brain-ingest` via
  `launchAction`; **D-SB-6** pt-BR default, `task: transcribe`; **D-SB-7**
  provisioning folds into the existing BMAD gate; **D-SB-8/9** impeccable +
  Playwright-MCP, free to extend the DS.
  **One decision taken during implementation (user, 2026-07-26):** the model
  catalog uses **fp32 on WASM and q8 on WebGPU** — a per-device variant rather
  than one precision everywhere — because the T2 spike proved the quantized
  decoder cannot create a session on onnxruntime-web's WASM backend, while
  WebGPU can take the ~4× smaller weights. `downloadModel` therefore takes a
  variant, and `status()` records which one is on disk so a device that needs
  the other one re-downloads.
  **Shipped (T1–T22):** main `secondBrainService` (the `skills` CLI) +
  `secondBrainVault` (raw staging) + `whisperModelStore` (catalog, atomic
  download, delete) + `whisperHardware` (advisory recommendation) +
  `whisperProtocol` (`hive-model:`); `secondBrain:*` / `whisper:*` IPC + preload;
  renderer `SecondBrainGate`, `useSecondBrain`, `SecondBrainPanel` + `WikiTree`,
  `SecondBrainFab`, `IngestPanel`, and a `whisper/` folder (`audio`,
  `useWhisper`, `useAudioIngest`, `AudioFileTab`, `AudioRecorder`,
  `ModelManager`). `npm run verify` green: typecheck + **0 lint errors** +
  **1507** tests (baseline 1299). Every changed non-UI file ≥90%; every
  `secondBrain/` renderer file 100% statements/functions/lines. Real-Electron
  E2E passes under xvfb; 11 Playwright-MCP screenshots in dark + light.
  (2026-07-26)

- **D25 — Second Brain increment: ask-anything + the health-check cadence
  (T23–T26, same `feat/second-brain` branch).** Two gaps the user raised after
  M12 landed, both the same idea — *the app does the remembering*.
  **(a) Perguntar à base (SB-R9).** M12's `Consultar` launched a question-less
  `/second-brain-query`. Now `Ctrl/Cmd+Shift+K` (plus the panel's primary CTA and
  the FAB menu's first item) opens a one-field ask surface, and the question
  rides *inside* the command (`/second-brain-query <pergunta>`) so the transcript
  reads as what was asked. The **answer still renders in the chat** — the spec's
  non-goal (a second answer viewport) stands. It remembers the workspace's recent
  questions and teaches openers when there are none.
  **(b) Cadência do health-check (SB-R10).** The skill documents "run
  `/second-brain-lint` after every 10 ingests or monthly"; the app now keeps that
  ledger. **Where it lives is the load-bearing choice: `userData`, NOT the
  vault** — the vault is git-versioned and shared, so a counter bumping on every
  capture would mean a diff per ingest and a conflict per pull. The rule is one
  pure `deriveHealth(record, now)` in main; the renderer only renders. The
  calendar rule additionally requires ≥1 ingest in the window, so a base nobody
  feeds never nags (a reminder people learn to ignore is worse than none).
  Recording happens at **one** interception point (`WorkUI.launchBrainAction`),
  so no surface can forget the ledger or double-count. `Depois` snoozes 7 days
  and suppresses `due` but never clears `reason` — the panel keeps telling the
  truth, and the rail keeps its dot, so dismissing never strands the user (the
  same guarantee the update flow makes). Also implemented `Ctrl/Cmd+Shift+B`,
  which the rail had advertised via `aria-keyshortcuts` since M12 with nothing
  behind it. `npm run verify` green: **1569** tests (from 1507). (2026-07-27)
- **D26 — Feature `voice-prompt` (new milestone M13).** Planned 2026-08-04,
  branch `feat/voice-prompt` **off `feat/second-brain`** (the Whisper stack it
  consumes lives only there, never merged to `main`). Speak a prompt straight
  into the chat composer: press once, talk, watch phrases land at the caret
  while you are still talking — offline, pt-BR, no modal.
  **D-VP-1 is the decision to protect: Windows Voice Typing (`Win+H`) was
  researched and CUT.** Do not re-propose it. There is no public API (the only
  trigger is synthesizing the keystroke via `SendInput`, needing a native addon
  or a PowerShell shim), it **requires internet and runs in Azure** (which
  contradicts D-SB-1's offline posture and ships the squad's speech to
  Microsoft), it is a black box (text arrives as synthetic keystrokes — no
  start/stop events, no partials, no cancel, no error surface, no waveform),
  and its language follows the OS input language, not the app. `webkitSpeech-
  Recognition` is separately dead in Electron (electron#7758) and WinRT's
  dictation constraint is also a cloud grammar capped at ~10 s. One engine on
  every platform: the embedded Whisper already in the app.
  Other locked calls: streaming by pause, not one block at the end (D-VP-2);
  Chat composer first but built as a Chat-agnostic hook + presentational
  transport (D-VP-3); pt-BR fixed, no language picker (D-VP-4); capture starts
  **before** the engine is ready and the audio is buffered (D-VP-5); the engine
  pre-warms on `pointerenter`/`focus`, never at app start (D-VP-6); in-place
  mode change, never a modal (D-VP-7); no guessed partials, only a pending
  count (D-VP-8); discard restores the exact pre-dictation value *and* caret
  (D-VP-9); the design system is extended, never forked (D-VP-10). Renderer +
  design-system only — **zero new main-process code, zero new IPC**. Full
  evidence in `.specs/features/voice-prompt/context.md`. (2026-08-04)

- **D27 — Feature `turn-instrumentation` (new milestone M14).** Built
  2026-08-06 from a three-line user request ("execution times in detail, total
  and per task, live"; "send a message during a run and be queued"; "context
  window usage in detail"), all three benchmarked against Claude Code. Gray-area
  decisions taken during the build:
  - **(a) Where the numbers come from is split, deliberately.** *Durations* are
    measured in the renderer off the adapter's own events — the figure a user
    wants is *time since I pressed Enter*, not the CLI's internal accounting,
    and IPC latency is orders of magnitude below the displayed resolution.
    *Tokens and cost* can only come from the CLI, so `cliAdapterCore` parses the
    `usage` blocks off the `stream-json` `assistant` and `result` lines and
    emits a new `usage` `AgentEvent`. The CLI's own `duration_api_ms` is shown
    **beside** our wall-clock, labelled as a different thing — never averaged
    into one number that is true of neither.
  - **(b) Context = `input + cache_read + cache_creation` of the latest
    report.** That sum *is* what the model read on its last call, which is the
    window's occupancy and the same figure Claude Code's `/context` shows.
    `output_tokens` is excluded (it joins the *next* request's context), and the
    reports are a **latest-wins snapshot, not a sum** — a turn emits several as
    it grows, and summing them reports a conversation four times fuller than it
    is. Only the `final` report (one per turn, off `result`) accumulates into
    session totals. The window size itself is **curated per model** in the
    adapter (`AgentOption.contextWindow`, per C5) because no CLI reports its
    own; an adapter that declares none gets absolute counts and no percentage.
  - **(c) A stop or a failure HOLDS the queue.** Draining queued messages into
    a session the user just interrupted — or one that is erroring — is the
    opposite of what pressing Stop meant. Nothing is discarded; the strip says
    it is holding and offers one control to resume. Same reasoning for the pane:
    switching conversations **parks** the queue with the conversation it belongs
    to rather than dropping it, and it comes back held.
  - **(d) The interrupt left the send button.** With the composer open during a
    run, the primary button has a job that outranks stopping: committing what
    was just typed. So Stop became its own round control beside it (keeping the
    breathing ring, which was doing real work), and the primary button changed
    only its glyph and its promise. One control, one meaning, each.
  - **(e) The turn meter replaced the typing indicator.** The bouncing dots
    could say one thing — "something is happening" — and only when nothing else
    was. The meter always has something truer to say (which phase, how long),
    and it settles into the turn's receipt instead of vanishing. `TypingIndicator`
    stays in the design system, unused by chat.

  Renderer + one `usage` event in the adapter contract; **no new IPC channel**
  (it rides the existing `agent:event` stream). One additive design-system prop
  (`PromptInput.sendIcon`). (2026-08-06)

- **D28 — Feature `shortcut-scopes` (new milestone M16).** Built 2026-08-08 from
  two user requests: the role becomes a **first-run-only** setting (no longer
  editable in the profile sheet), and shortcuts split into **two independent
  sets** — "para iniciar" (the hero) and "durante a conversa" (the strip above
  the composer), the latter defaulting to `bmad-party-mode` for the PM and to
  **nothing** for every other role. Full spec + gray-area decisions in
  `.specs/features/shortcut-scopes/spec.md`; the load-bearing ones:
  - **(a) The role stops being a control the moment it stops being safe to
    change.** It decides two derived sets, and re-picking it in the sheet
    rewrote both from a place where that consequence is invisible. It stays in
    the sheet as **read-only context** (it's what "Padrão do papel" refers to),
    with the sentence that says where it was decided, and the sheet sends
    anyone who wants different shortcuts to the thing that actually changes
    them. `App` no longer carries an `onRoleChange` at all.
  - **(b) `Config.shortcuts` becomes `{ start, during }` and migrates on read.**
    The pre-split flat `{ skills, agents }` was the hero selection, so it lifts
    into `start`; `during` starts from the role default. `shortcuts:set` is
    scoped and **drops an unknown scope** rather than defaulting — writing the
    wrong set is worse than writing none. `shortcuts:actions` stays unscoped and
    returns both, because the two surfaces always render together.
  - **(c) Two sets is one concept more than a picker carries for free, so the
    picker shows it instead of explaining it.** A DS `SegmentedControl` (with
    per-scope counts) switches sets; under it, a miniature of the surface the
    active set lands on, painted with the *real* chip classes over a stand-in
    composer — centered for the hero, docked-left for the strip. The empty state
    is part of the lesson ("a barra acima do campo de mensagem some").
  - **(d) An empty `during` set renders no strip at all**, not even the
    customize control. Most roles ship none; a permanent "configure me"
    affordance over every conversation is chrome advertising itself. The two
    always-reachable ways in are the hero pill and the profile sheet.

  Main + preload + renderer; **no new IPC channel** (the three `shortcuts:*`
  handlers changed shape). One new app-level DS override (`.hds-badge-muted`,
  see Lessons). (2026-08-08)

- **D29 — Isolated content is authenticated by source + nonce, never by
  origin.** An iframe sandboxed without `allow-same-origin` reports
  `origin: "null"`, so comparing `event.origin` against an expected string is
  security theater — every opaque origin matches equally. The Design Studio
  Preview bridge instead requires **both** `event.source === frame.contentWindow`
  (the handle cannot be forged by an unrelated window) **and** a per-session
  random nonce. This is the convention for any future isolated content in the
  app, not a Design-Studio-local trick. (design-studio D-DS-4, 2026-08-09)

- **D30 — A design system's component catalog is derived from its
  `custom-elements.json` at build time, never hand-written.** The CEM already
  carries tag, attribute types (including enum members), slots and events for
  every element; transcribing that by hand makes "single source of truth"
  aspirational instead of mechanical, and it drifts on the first upstream
  release. The generator freezes a lean `catalog.json` into `resources/` so the
  main process never parses 2 MB at boot and the catalog stays reviewable in a
  diff. Applies to any second DS adapter. (design-studio D-DS-5, 2026-08-09)

- **D31 — Vendor icon fonts/CDNs are replaced by a locally registered icon
  library.** Web Awesome's `wa-icon` resolves against a Font Awesome CDN by
  default and the package ships zero SVGs, so under a restrictive CSP every
  icon fails *silently* — identical on screen to one that never rendered.
  Icons are registered via `registerIconLibrary()` against SVGs embedded at
  build time. An unknown icon resolves to nothing and **never falls back to the
  vendor CDN**: fail-closed, so a gap is a visible bug rather than a hidden
  network call. (design-studio D-DS-8, 2026-08-09)

- **D32 — `connect-src data:` is the correct floor for isolated content that
  renders icons — `'none'` is not achievable.** Measured, not assumed:
  `wa-icon` resolves every icon through `fetch(url, { mode: 'cors' })`
  (`chunk.ZCZ2WKQR.js:62`), and `connect-src` governs `fetch` even when the URL
  is a `data:` URI, so `'none'` blanks every icon. The only fetch-free path Web
  Awesome offers (`spriteSheet`, via `<use href>`) is unusable: Chrome dropped
  external `<use>` references and they do not cross shadow roots. Network
  egress remains **zero** — a `data:` URL reaches no server — so the security
  property is intact and only the wording of the AC changed. The honesty of
  that claim is enforced by a real-Electron E2E that observes the frame's
  traffic and requires every request to be `hive-studio:`; measured at
  4 requests, all local. Chosen over `hive-studio:` because the exported Bundle
  is a loose `.html` with no custom protocol and needs `data:` regardless — one
  icon strategy instead of two diverging ones. (design-studio D-DS-4/D32,
  2026-08-09)

- **D33 — Anything shipped under `asarUnpack` is addressed from the main
  bundle, never from `process.resourcesPath`.** `asarUnpack: resources/**`
  places those files at `<resourcesPath>/app.asar.unpacked/resources/`, while
  `process.resourcesPath` points one level above at `<resourcesPath>/` — so
  reading through it 404s every unpacked artifact **in the packaged app and
  nowhere else**. Unit tests, dev runs and every E2E against `out/` stay green,
  because none of them has an asar at all. A path resolved from the main
  bundle (`join(__dirname, '../../resources')`) is correct in both shapes:
  packaged it lands inside the asar, where Electron's own fs shim redirects
  unpacked entries to `app.asar.unpacked/`. Found by `npm run build:unpack` at
  the end of M18 — the check `tasks.md` had asked for at the end of phase 2 and
  that phase did not run. (design-studio T7.8, 2026-08-10)

- **D34 — Feature `explorer-os-actions` + `selection-contrast`.** Four
  user-reported improvements, built 2026-08-15. Three are OS-file-manager
  parity in the explorer (copy relative/absolute path, open in the host's file
  manager, Shift-click range) and one is a WCAG defect in the chat.
  Decisions:
  (a) **Copy path is two actions, not one.** Relative is the tree's own key and
  never leaves the renderer; absolute round-trips to main, because only main
  knows the workspace's location and the host's separator — a renderer-composed
  path would be `/`-joined on Windows.
  (b) **Reveal is two verbs.** A file is revealed highlighted inside its parent
  (`shell.showItemInFolder`), a directory is opened as the window's own target
  (`shell.openPath`) — revealing a folder shows its parent, which is never what
  "open this folder" means. Both route through `fsService.absolutePathFor`, so
  the workspace-escape check is the point of the bridge, not an afterthought.
  (c) **Selection targets the whole selection.** An action invoked on a row
  that is part of a multi-selection applies to all of it (the rule
  `requestDelete` already used) — the alternative silently ignores five of six
  selected rows.
  (d) **Labels follow the OS**, via a new `window.hive.platform` string:
  "Finder" on macOS, "Explorador de Arquivos" on Windows, the generic noun on
  Linux (which has no single name for it). A value, not a call — a label that
  awaits an IPC round trip renders wrong on first paint.
  (e) **The Shift-click fix belongs in the DS, not the app.** A folder row's
  whole label is the `Tree`'s expand/collapse `<button>`, which stopped the
  click before it could select — so a folder could not be selected, anchor a
  range, or end one, and Shift-clicking one collapsed it instead, reordering
  the list the range is measured over. Selection now happens on every row
  click; expanding is suppressed under a modifier. `Shift+Arrow` was added
  alongside it — the WAI-ARIA multi-select tree pattern requires the keyboard
  half, and PRODUCT.md promises full keyboard operability.
  (f) **`::selection` resolves through tokens.** `--selection-bg`/
  `--selection-ink` (tokens.css) replace the raw `--accent`/`--bg` pair the DS
  hardcoded. `::selection` resolves `var()` against its originating element and
  custom properties inherit, so an accent-filled surface reaponts the pair on
  itself — two lines next to the fill that causes the problem, and no second
  rule to keep in sync. See `docs/visual-validation.md` for the measurements.
  (2026-08-15)

- **D35 — Feature `product-identity` (M21).** Four user-reported items, built
  2026-08-16: the chat's file mentions move from `#` to `@`, the app is called
  **Hive** (not "Hive Desktop"), its icon is the HIVE mark, and the Windows
  installer is a branded assisted flow. Decisions:
  (a) **`@` only opens after whitespace**, so `contato@exemplo.com` is never a
  mention. `#` becomes inert — Markdown headings and hashtags stop lighting up
  the composer, which is why the sigil moved in the first place.
  (b) **The menu explains its ranking.** Match ranges are computed once over
  the *whole path* and then sliced per line, so the highlight can never
  disagree with the score that put the row there. The row is one line (name,
  then folder): stacked rows ran ~55px and showed 4 of 8 matches.
  (c) **The rename migrates `userData`, it does not abandon it.**
  `userDataMigration.ts` moves the legacy directory by `rename` (same parent,
  atomic) as the first statement in `whenReady`, refuses to migrate onto a
  directory that already holds real data, and never overwrites a file already
  at the target. Every future name goes into `LEGACY_USER_DATA_NAMES`.
  (d) **`appId` changed** from the `com.electron.app` placeholder to
  `dev.gustavobruno.hive`, and `electronApp.setAppUserModelId` now matches it —
  a mismatch makes a pinned taskbar shortcut and the running window read as two
  different programs. Safe only because the app has never been published.
  (e) **Brand rasters are generated, never drawn.**
  `scripts/gen-brand-artwork.mjs` derives the `.ico`, `.icns`, PNGs and the
  four NSIS bitmaps from one SVG, with a *different drawing* below 48px (see
  L-PI-1). (2026-08-16)

- **D36 — Feature `mcp-probe-path` + `approval-session` (M22).** Two
  user-reported items, built 2026-08-19. Decisions:
  (a) **The MCP probe spawns like every other CLI in the app.**
  `mcpProbe.ts` was the one spawner still calling `child_process.spawn` with
  raw `process.env`, so "Testar conexão" on the canonical
  `npx -y @playwright/mcp@latest` reported `Comando não encontrado: "npx"` on
  machines where that line runs in any terminal — a desktop app launched from
  a launcher inherits no npm/nvm prefix, and on Windows `CreateProcess` cannot
  find or run an `npx.cmd` shim at all. It now goes through
  `cliEnv()` + `spawnTarget()` like `processRunner` does, via an exported
  `stdioSpawnPlan()` seam so the lookup is testable without a child process.
  The server's own `env` from `.mcp.json` still wins over the widened base.
  (b) **The stdio probe waits 30s, the remote one still 10s.** `npx -y` on a
  cold cache downloads the package before writing a byte of JSON-RPC; measured
  on `@playwright/mcp@latest` it passed 10s and the probe called a working
  server a timeout. The timeout copy now names the first-run download.
  (c) **"Permitir tudo nesta sessão" is memory-only and revocable.** A fourth
  answer on the permission card, with `ApprovalDecision.scope: 'session'`. It
  writes **nothing**: no standing rule in the config store, no rule into the
  agent's own `.claude/` permissions (that is what `always` is for), and it is
  gone on restart. Arming it releases every request already parked, so a user
  who just said "tudo" is not handed the next card immediately.
  (d) **It is not a fourth peer button, and it is never invisible.** The three
  answers about *this* call keep the actions row; the blanket grant sits under
  a hairline at link weight with its end-condition beside it — the
  widest-reaching answer must not be one mis-click from the narrowest. While
  it is armed the composer carries a standing chip with its own undo
  ("Voltar a perguntar"), in both the empty and the conversation layouts,
  because a permission you cannot find is one you cannot take back. The
  renderer mirrors the flag from the main process at mount, so a reloaded
  window never claims the agent is still asking. (2026-08-19)

- **D37 — Feature `second-brain` Fase 9: modelos embutidos + transcrição
  editável (M23).** Dois pedidos do usuário, construídos 2026-08-19. Decisões:
  (a) **Os três primeiros modelos do Whisper viajam dentro do app, em fp32.**
  `tiny`/`base`/`small` em `resources/whisper-models/`, buscados por
  `scripts/fetchWhisperModels.mjs` no empacotamento e **fora do git**: ~1,3 GB
  de ONNX imutável e endereçável por conteúdo pertence ao instalador, não a
  todo clone, todo branch e todo `git gc`. fp32 porque é a única precisão que
  cria sessão no backend WASM (spike T2); o usuário escolheu explicitamente
  pagar o tamanho em vez de verificar q8 antes.
  (b) **`hive-model:` resolve por caminho de busca, não por raiz única.**
  `userData` primeiro, `resources/` depois — "embutido" vira piso e não teto: um
  modelo baixado sombreia o de fábrica, apagá-lo volta para ele, e `remove()`
  nunca toca na instalação. A guarda de path-escape é aplicada **por raiz**, de
  modo que a segunda raiz amplia o que pode ser servido sem ampliar onde um
  caminho forjado alcança.
  (c) **`useWhisper` prefere o que já está em disco — se este aparelho puder
  rodar.** fp32 roda bem em WebGPU, então uma máquina com GPU usa a cópia
  embutida em vez de baixar q8 para não economizar nada. O contrário **não** é
  simétrico e a assimetria é a regra inteira: q8 não cria sessão em WASM, então
  uma cópia q8 sobrando de uma execução WebGPU é inutilizável na CPU e precisa
  ser rebaixada. Um teste existente pegou exatamente essa regressão.
  (d) **A recomendação de hardware deixou de ser conselho e virou decisão.**
  `whisper:preference` resolve no main — pin do usuário quando ainda utilizável,
  sonda caso contrário — e **só responde com modelo embutido**, afirmado como
  propriedade sobre toda a matriz RAM×GPU×núcleos. Uma escolha automática que
  implicasse download seria o app decidindo gastar a noite de alguém.
  (e) **Enviar áudio encena antes de processar.** Escolher arquivo não começa
  mais minutos de CPU; os arquivos esperam numa lista removível com o tamanho
  do lote, e um botão primário começa. Duas decisões voltaram para o usuário:
  quais arquivos entram e qual modelo roda.
  (f) **"Gravar áudio" morreu; "Ditar ao vivo" nasceu do M13.** Microfone,
  segmentador e motor ao mesmo tempo — frases cortadas no silêncio, transcritas
  enquanto a próxima é falada, cada uma caindo no documento com o trecho
  recém-escrito marcado. `useDictation`/`useComposerDictation` reaproveitados
  inteiros (nunca importaram de `chat/`), então foi fiação. `AudioRecorder`,
  `Waveform` e `AudioFileTab` foram apagados.
  (g) **Componente novo no DS: `HighlightedTextarea`.** A técnica do espelho
  transparente estava soldada dentro do `PromptInput`; extraída, porque o que
  precisa dela agora não é um compositor e sim um campo escrito **enquanto o
  microfone está aberto**. `RadioGroupItem` ganhou `children` para que a linha
  inteira seja o controle — `<label htmlFor>` não nomeia um `<button
  role="radio">` do Radix, então a versão anterior tinha alvo de clique morto e
  controle sem nome acessível.

  **Armadilhas medidas neste passe (nenhuma pegável por teste):**
  - A folha de ingestão era **400 px desde o M12**: `.wb-brain-ingest` (0,1,0)
    perdia para `.hds-sheet-content[data-side="right"]` (0,2,0), então o
    `width: 520px` do app nunca valeu. Achado medindo o nó renderizado.
  - `.wb-doc` **já existia** para os viewers de documento (`flex: 1 1 0; height:
    100%`), e a colisão esticava o container da transcrição para 574 px em
    volta de um campo de 151 px. Renomeado para `.wb-transcript*`.
  - `RadioGroup.Indicator` do Radix só monta quando marcado, então três das
    quatro linhas do seletor não tinham bolinha nenhuma.
  - A marca do trecho recém-transcrito começava a esmaecer no primeiro frame:
    600 ms depois já estava totalmente transparente. Virou "segura, depois
    esmaece".
  - Um `vi.mock` de fábrica **síncrona** referenciando `createContext` do escopo
    do módulo passa em execução normal e quebra sob instrumentação de cobertura
    (`Cannot access '__vi_import_4__' before initialization`). Fábrica async com
    os imports dentro.
  - A sonda de contraste precisa de `oklch()` **e** `oklab()`: token declara num,
    `color-mix(in oklab, …)` serializa no outro, e sem os dois ela devolve
    `UNMEASURED` — que se lê como "sem achados". Dois contrastes reais só
    apareceram depois disso, um deles virando `--success-tint-ink` no DS.

## Lessons (four fixes: collapse-all, appearance menu, the interrupt, the first-run copy — 2026-08-21)

On `feat/voice-prompt`. `npm run verify` green (3719 tests, typecheck + lint
clean). The coverage gate's only two misses are the pre-existing ones, and both
**improved**: `preload/index.ts` functions 88.99 → 89.92, `explorer/Explorer.tsx`
branches 89.56 → 89.96. Visual pass: 3 themes x (explorer, appearance menu,
interrupt, pane menu, context menu) + the preparation gate, 15 contrast targets,
0 failures.

- **`justify-content: space-between` is wrong on a menu item whose children are
  the consumer's.** It shipped in the DS to push the `Ctrl+X` shortcut to the
  edge, and for `DropdownMenuItem` — exactly two children, one of them the
  shortcut — it does that correctly. `RadioItem`/`CheckboxItem` render whatever
  the caller passes, so the same rule **right-aligns their content**: the
  appearance menu's three options indented at 69px, 92px and 120px, each by the
  length of its own text. Nobody measures indentation, so it lived in the DS
  from the day the component was written. `flex-start` on the item plus
  `flex: 1` on the label slot gives the shortcut the same position and stops
  punishing everyone else. `ContextMenu` had the identical latent defect.

- **`child.kill()` does not stop the agent on Windows, and the failure is
  silent.** The agent turn runs inside a shell (agent-terminal). On POSIX
  `shellSpawnTarget` uses `exec`, so the shell *becomes* the CLI at the same pid
  and the signal lands. Windows has no `exec`: the tree is
  `cmd.exe → claude.cmd → node`, `kill()` reaped only `cmd.exe`, and the
  surviving CLI held the inherited stdout — so Node's `'close'` never fired,
  `exitCode` never resolved, the turn never settled, and the Stop button was
  exactly what the user reported: click, nothing. Fix is two independent parts
  and both are load-bearing: kill the **tree** (`detached` + `kill(-pid)` on
  POSIX, `taskkill /T` on Windows), and **settle the turn on the click** rather
  than on the process agreeing to die.

- **A fake that always behaves cannot catch a bug about misbehaviour.** Every
  existing interrupt test passed against the broken app, because
  `createFakeProcessRunner`'s `kill()` resolved the exit immediately — the
  double settled the turn all by itself. `ignoresKill` is the script option
  that reproduces the real process; the regression test that matters uses
  **real** processes (a child that spawns a grandchild and exits) and asserts
  that `output` *ends*, which is the only observable proof that no descendant
  is still holding a file descriptor.

- **A control that looks identical after you press it reads as broken**, and the
  user is right about the experience even when the backend is now correct. The
  interrupt was a grey chip beside a filled accent send button — two circles of
  the same weight, neither saying which one halts. It now carries the danger
  family at rest, and a `data-stopping` state closes a solid ring the moment it
  is pressed. `disabled` was deliberately **not** used for that state: a
  disabled button drops focus to the body, stranding a keyboard user in the one
  interaction where staying put matters most. The repeat press is refused in
  the handler instead.

- **Esc means "close what is open" before it means "stop what is running."** The
  binding is scoped to the composer subtree and runs strictly after the slash
  menu, the mention menu and the dictation take have each had the event — get
  the order wrong and dismissing a menu silently kills the turn behind it. A
  pending permission card holds its own focus and reads Esc as "Recusar", so it
  is never second-guessed from here.

- **The first-run screens were teaching the engine's vocabulary.** "Instalando o
  BMAD", "BMad Method", "skills de base de conhecimento da squad" — none of it
  means anything in a user's first minute, and "something I didn't ask for is
  installing itself" is the available reading. The copy now names the delivery.
  The `--modules` **ids** are untouched (they are wire format); only the labels
  are ours. Step labels stream from the CLI, so they pass through
  `installStepLabelPtBR`, which renames what it recognizes by module code and
  **quotes verbatim what it does not** — inventing a friendly name for an
  unknown step would hide work the user is actively waiting on.

- **The emblem was a lattice with a logo in it.** 19 hexagons around a 40px mark
  in a 184px frame: the identity on the most-seen first-run screen was a grid,
  and the brain rendered as a small dark ring inside somebody else's pattern.
  It is now the mark at 96px with signal rings leaving it. Two traps came with
  that — `transform-origin: center` on an SVG circle resolves against the
  *viewport* without `transform-box: fill-box`, and one screenshot cannot tell
  a wrong animation from a design decision (photograph three phases).

## Lessons (voice-settings, 2026-08-21)

M25 on `feat/voice-prompt`. `npm run verify` green (3703 tests, typecheck +
lint clean); the only coverage miss is `preload/index.ts`'s pre-existing
89.92% functions, untouched here. Visual pass 5 states x 3 themes via
`tools/visual/profile-voice-pass.mjs` (0 failures, 0 `missing`) plus 9 real-app
`e2e/contrast.spec.ts` sweeps.

**The shape of the change.** The transcription model was a *global* setting
living in a *local* place: it sat at the bottom of the ingestion sheet, where it
read as a per-ingestion option — and the chat composer, the surface people
actually dictate into, never consulted it at all and ran a hardcoded `base`. The
chooser moved to Perfil › Voz e transcrição; both composers now resolve the same
preference from main; the ingestion sheet keeps a read-only statement of which
model is about to run, plus a link to the one place that changes it.

- **D-VS-1 — the automatic ladder is `small` → `tiny` → `base`.** Prefer the
  most accurate bundled model wherever it will actually run (a real GPU and
  >= 8 GB RAM), drop to the *fastest* model when it will not, and use `base`
  only when the probe read nothing at all. User decision, 2026-08-20.
  **The GPU is the gate and is not negotiable:** without one the pipeline runs
  fp32 on a single WASM thread (M12.3), where `small` is minutes per take —
  preferring it anyway would ship a dictation box that appears to hang, not a
  more accurate one. Note the second rung is a deliberate *quality* trade the
  user asked for: a CPU-only machine that used to get `base` now gets `tiny`.
- **L-VS-1 — `getBoundingClientRect` cannot see a rasterisation defect.** The
  bug that opened this milestone ("the radio dot is not centred") measured
  **perfectly symmetric** in layout — 3.5px on all four sides — while the screen
  showed the fill pushed up and left. A 1.5px `border` resolves to an integer
  number of device pixels per edge, and the fill was `inset`-positioned from the
  padding box, which moves with that rounding. The fix is structural, not a
  value: ring by `box-shadow: inset` (no padding box), fill centred by
  `place-items` (exact by construction). **The proof is a pixel, not a number** —
  render a magnified clone outside the sheet's `overflow` and photograph it.
- **L-VS-2 — the same fact three times, again.** The scope opened with the
  sheet's description ("the model … in the chat and in ingestion"), repeated it
  as its own paragraph 40px below, and announced "Melhor escolha aqui: small"
  directly above a chooser whose first row and caption both already said it.
  Third milestone with this class (M19's status bar, M20's terminal picker).
  The rule that resolves it: two voices survive only if they answer *different*
  questions — the description says **where it applies**, the paragraph says
  **where it runs**.
- **L-VS-3 — `1fr` is not `minmax(0, 1fr)`.** A `1fr` track floors at its own
  content width, so the neighbouring column can never claim space the first one
  is not using: "Automático · Git Bash" arrived as "Automático · Git…" with half
  the row empty. Truncation is *measurable* (`scrollWidth > clientWidth`) — that
  assertion now runs across all three themes, which a screenshot cannot.
- **L-VS-4 — insufficient specificity fails nowhere.** `.wb-profile-sheet`
  (0-1-0) lost to the DS's `.hds-sheet-content[data-side='right']` (0-2-1), so
  the sheet's `width` declaration had been in the file, correct, and **inert**
  since the day it was written. No CSS error, no build error, and the inherited
  value is plausible. When overriding a design-system measurement, **repeat the
  shape of its selector**, not just your own class.
- **L-VS-5 — a sample-count floor is not a contrast assertion.** The shortcuts
  sweep failed with `expected > 5, received 5` after the drill-down made that
  detail smaller — `sampleTextContrast` deduplicates by (colour, background,
  size, weight), so a small surface built from shell tokens yields few distinct
  samples *by construction* (L-DS-6, one milestone on). What proves the surface
  opened is the `waitFor`, which fails with a timeout rather than a quiet zero.
- **L-VS-6 — splitting a gated file silently drops its gate.** `ProfileSheet.tsx`
  became a module of eleven files; the `vitest.config.ts` entry named the old
  path, so every new file would simply not have been measured and the report
  would have stayed green. The entry is now the glob `profile/**`. Same family
  as L-AS-3: **the harness is part of the change, not a follow-up to it.**

## Lessons (mcp-probe-path + approval-session, 2026-08-19)

Built on `feat/voice-prompt`. `npm run verify` green (3673 tests); visual pass
2 states x 3 themes plus the MCP failure panel, via
`tools/visual/approvals.mjs`.

- **L-AS-1 — a probe that closes menus with `Escape` answers the card it came
  to photograph.** The approval card takes focus on mount and reads `Escape`
  as "Recusar", so the first pass produced a screenshot of a *denied* request
  and a contrast reading of the wrong state. Visual probes blur
  (`document.activeElement?.blur()`), they do not press `Escape`.
- **L-AS-2 — `--danger` is a fill hue, not body ink.** The MCP probe's failure
  line — the one sentence whose whole job is to explain why a server did not
  connect — measured **3.88:1** in dark and **4.24:1** in hive at 13px. Same
  trap as `--faint` (L-M14), one family over: `--danger-ink` measures
  5.08 / 5.55 / 5.75 on the same surface. The rule that resolves it is the
  same one: if someone *reads* it, it is an `*-ink` rung or darker.
- **L-AS-3 — a mock that lags the preload contract crashes the boot, not the
  feature.** `Chat` reads the session grant once at mount; until
  `tools/visual/boot.mjs` grew `agent.approvalSession`, the whole work UI
  rendered blank and the console error was the only clue. The visual harness
  is part of the preload surface — extend it in the same commit as the API.

## Lessons (product-identity, 2026-08-16)

M21 shipped on `feat/voice-prompt`. `npm run verify` green; visual pass 3
states x 3 themes, 42 reads, 4 defects fixed that no test could have seen.

- **L-PI-1 — an app icon is several drawings, and the small one is measured,
  not assumed.** The HIVE mark is a brain built from hairline circuit traces.
  Rendered at 48px and inspected at 7x on the real raster, the gaps between the
  traces close and the whole thing paints as a dark doughnut; at 40px and below
  there is nothing left to recognise. So the `.ico` carries the hexagon cell
  (the app's own small mark, already in the chat hero) at 16–40 and the brain
  at 48+, and the tile's inset varies by size — 8.5% at 48px, 15% at 1024px,
  because a 48px tile has no pixels to spend on margin. `--contact-sheet`
  renders every size at true scale on light and dark; judging a 16px icon at
  400% is not judging a 16px icon.

- **L-PI-2 — renaming the product moves the user's data.** Electron derives
  `userData` from `app.name`, so `productName: Hive` silently relocates the
  config store, the chat history, the second-brain ledger and the downloaded
  Whisper models. The app would have opened looking factory-fresh with the old
  folder still on disk. The migration has to run *before the first store's
  constructor*, because every store reads its file eagerly — there is no later
  safe moment. Nothing links `electron-builder.yml` to the dev-run name but
  `appIdentity.test.ts`; without it, dev and production write to different
  directories and only a real install shows it.

- **L-PI-3 — the contrast probe's parser is a source of false passes.** The
  composer's mention pill is `color-mix(in oklab, …)`, which Chromium computes
  to `oklab(L a b / α)` — a form the shared probe's regexes don't know. It
  parsed as "no background", so the pill measured **1.00:1 against the surface
  it was sitting on** and the pass reported it as a defect that wasn't there,
  while the real defect (a tint too faint to see in `hive`) went unmeasured.
  Any colour form the regexes miss now falls through to a 1x1 canvas, which
  resolves anything CSS accepts. This is a fourth entry for
  `docs/visual-validation.md`'s list of parser traps, and the most dangerous
  kind: it fails *loudly on the wrong thing*.

- **L-PI-4 — a floor invented at the keyboard is not a measurement.** The
  "is the pill visible at all" check started at 1.3:1 because it looked like a
  reasonable number. The screenshot at exactly 1.30:1 showed a smudge. Raised
  to 1.7 it failed a pill that reads perfectly at 1.60:1. The floor now sits at
  1.5 with the two screenshots that bracket it named in the comment. Where
  WCAG has no number, the threshold has to be calibrated against images and its
  evidence written down, or it is just a preference with a decimal point.

- **L-PI-5 — a third theme silently misses every token block written for two.**
  `--wb-ic-*` (the file-type icon hues) had a light ramp on `:root` and a dark
  ramp on `[data-theme='dark']`. The `hive` theme is dark and got the *light*
  ramp, painting L~52% hues on near-black bordô at 2.57:1 — in the explorer
  tree, the viewer header and the search dialog, not just the surface that
  found it. When a token block is keyed by theme, grep for every theme
  selector, not just the one being worked on.

- **L-PI-7 — electron-builder's "is the app running?" check matches a path
  prefix, not a program, and it dead-ended the install.** Reported from a real
  Windows run: "Não é possível fechar o Hive. Feche a janela do Hive e clique
  em Repetir", with no Hive window open and Retry looping forever. The stock
  macro (`templates/nsis/include/allowOnlyOneInstallerInstance.nsh`) matches
  `$_.Path.StartsWith('$INSTDIR')` — a raw string prefix, no separator, no
  executable name. Two consequences, both ours:
  (a) **We ship the agent CLI inside the app folder**
  (`resources\app.asar.unpacked\…\claude-code\bin\claude.exe`). A turn can
  leave one alive after the window closes, the prefix match finds it, and the
  message then instructs the user to close a window that does not exist. The
  stock first kill pass is also un-forced, which a headless console child
  ignores.
  (b) **`…\Programs\Hive` is a case-insensitive string prefix of
  `…\Programs\hive-desktop`** — so the rename made the new installer report the
  *old* install as "Hive". A rename that shortens the product name to a prefix
  of the old one is exactly the case this check cannot tell apart.
  `build/installer.nsh` now defines `customCheckAppRunning`: match `$INSTDIR\`
  (a directory, not a string), force-kill from the first pass, and — when
  something still survives — **name the processes** instead of pointing at a
  window. Never matches a bare image name: the user's own `claude.exe` on PATH
  is not this installer's business.

- **L-PI-8 — the app leaks its agent CLI on quit, and that is the upstream
  cause of L-PI-7.** `window-all-closed` calls `app.quit()`; nothing stops
  in-flight turns first. On Windows the CLI is a *grandchild* (M20 wraps the
  turn in `cmd /d /s /c`), and killing the parent does not kill the tree —
  `child.kill()` reaches the `cmd`, not the `claude.exe` under it. So a normal
  quit during a turn leaves a process running out of the install folder, which
  then blocks the next install. Not fixed here (main-process lifecycle work
  with its own risk); the installer stops dead-ending on it. A real fix needs
  `taskkill /T /F` on the pid, on quit, on Windows.

- **L-PI-6 — the NSIS installer can be run and looked at on this machine.**
  `Xvfb :99 -fbdir <dir>` writes a live XWD dump of the root window, and
  `wine <installer>.exe` under that DISPLAY renders the real thing; the dump
  parses with ~20 lines of Node and `sharp`. That screenshot caught a copy
  defect no compile could ("Clique em Avançar" against a button the pt-BR NSIS
  language file labels `Próximo`). No `xdotool` here, so pages past the first
  are not clickable — the welcome page is what this proves.

## Lessons (agent-terminal follow-up, 2026-08-18)

Reopened on a bug report: *"mesmo selecionando Prompt de comando ou gitbash, o
agente sempre permanece utilizando por padrão o powershell"*, with the agent's
own answer pasted in — "PowerShell como shell primário, com Bash também
disponível". `npm run verify` green: **3665 tests / 213 files**, 0 lint errors,
every coverage gate passing. E2E `agent-terminal.spec.ts` green against the
real app. Visual pass: 3 states x 3 themes, **123 contrast reads, 0 failures**.

- **L-AT-6 — "set nothing and let it decide" is a coin flip, not a default.**
  The quoted sentence is printed verbatim by the CLI's own environment block
  (`Sba()` in claude 2.1.226), and the branch that produces it is `LY()`:
  with `CLAUDE_CODE_USE_POWERSHELL_TOOL` **unset** on Windows it ends at
  `nt("tengu_cobalt_ridge", !1)` — a *remote feature gate*. M20 wrote that
  variable only to turn PowerShell **on**, never off, so picking Git Bash or
  cmd left the answer to a flag Hive doesn't control. Every Windows binding
  now writes `0` or `1` explicitly. The general rule: when another program's
  behaviour is "unset → we decide", unset is not neutral, and the only
  reproducible state is the one you set.

- **L-AT-7 — a default that guarantees a fallback is a bug, not a default.**
  M20's "Automático" meant *the platform default*, which on Windows is cmd —
  the one shell no agent here can execute a command in. So the users most
  likely to hit the bug were the ones who never touched the setting. Automatic
  now resolves to a shell the enabled agents actually run in (Git Bash before
  the PowerShells on Windows; `$SHELL` on macOS and Linux, where it is already
  what the CLI accepts). `shellCatalog` still reports only what the *machine*
  prefers — the product preference lives in `shellService`, which is the module
  that knows both.

- **L-AT-8 — Git Bash rewrites arguments that look like paths.** Git Bash is
  MSYS2, and MSYS2 converts POSIX-looking arguments before handing them to a
  native Windows exe. A turn goes out as `-p '<mensagem>'`, so `/bmad-prd` —
  every BMAD workflow — would reach `claude.exe` as
  `C:/Program Files/Git/bmad-prd`. Silent, and latent in M20 the whole time.
  `MSYS_NO_PATHCONV=1` + `MSYS2_ARG_CONV_EXCL=*` now ride with that shell.

- **L-AT-9 — the picker had to name the destination, not describe the
  situation.** M20 answered "o que isso muda para cada agente" in a paragraph
  per agent, and the single fact a reader needed — *which shell* — was never in
  it. Each agent now gets one line, `Claude CLI → Git Bash`, amber when it
  isn't the shell that was picked, plus the literal command line behind a
  disclosure. Two DS components came out of it (`RadioCard`, `CommandLine`) and
  three defects were caught by looking rather than by testing: the "Automático"
  row described the *picked* shell instead of its own rule, the cmd receipt
  printed its caret transport (`^"C:\…^"`) as if it were the command, and the
  `Badge` muted variant fell to 3.81:1 once it landed on the selected card's
  tint. **Open, not fixed:** `hds-badge-muted` hardcodes
  `rgba(38, 10, 18, .4)` and takes `--muted` for ink — 4.21:1 in the light
  theme wherever it is used. Re-toned locally here; the DS-wide fix is its own
  change.

- **L-AT-10 — a contrast probe that can't parse the palette reports a pass.**
  `tools/visual/shell-contrast.mjs` matched colors with regexes and answered
  `UNMEASURED` for every `oklch()` token — which is most of the semantic
  palette, including the amber and accent-tint runs this change added. Now it
  paints into a 1x1 canvas and reads the pixel back, which normalizes any
  syntax. The trap on the way: `getImageData` hands back **un-premultiplied**
  RGBA already, so "undoing the premultiply" is a second correction — it drove
  the 16% coral tint to near-white and turned 41 passing reads into failures.
  Cross-check a rewritten probe against a known-good measurement before
  believing either.

## Lessons (agent-terminal, 2026-08-14)

M20 shipped on `feat/voice-prompt`. `npm run verify` green: **3514 tests / 209
files** (from 3419 / 205), 0 lint errors, every coverage gate passing. Full E2E
suite green (63/63). Visual pass: 3 states x 3 themes, 57 contrast reads, 0
failures.

- **L-AT-1 — when the rule belongs to someone else's program, measure that
  program before writing the rule.** The whole feature rests on how the Claude
  CLI picks its own shell, and none of it was guessable. Read out of the
  shipped binary (`strings` over `claude.exe` 2.1.226): `CLAUDE_CODE_SHELL` is
  accepted **only** for a path containing `bash`/`zsh` and executable —
  anything else is logged "not a valid bash/zsh path, falling back to
  detection" and dropped; Windows executes `Bash` through Git Bash
  (`CLAUDE_CODE_GIT_BASH_PATH`); `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` enables
  the PowerShell tool; and there is **no cmd executor at all**. Had we shipped
  the obvious mapping (fish → `CLAUDE_CODE_SHELL=/usr/bin/fish`, cmd →
  "supported"), the setting would have done nothing while claiming to work.

- **L-AT-2 — `powershell.exe` silently rewrites the user's message.** Measured
  against the real 5.1 binary, spawning a program that prints its own `argv`:
  without pre-escaping, `{"json": "sim"}` arrived as `{json: sim}`, and a
  trailing backslash was eaten. PowerShell re-quotes each argument when it
  calls a native command and drops embedded double quotes doing it. No error,
  no warning — the agent just receives a different prompt than the user typed.
  `-EncodedCommand` does **not** fix it (measured too: same corruption); the
  fix is CRT-style pre-escaping of each argument inside the single-quoted PS
  string. Four prompts (JSON, quotes, `&`, accents, trailing `\`) now round-trip
  byte-exact.

- **L-AT-3 — putting a shell in the middle costs you the stop button, unless
  you `exec`.** `bash -c '<cli> …'` leaves bash as the process we hold, so
  `kill()` kills the shell and leaves the CLI running. `bash -c 'exec <cli> …'`
  replaces the shell, so the pid we hold *is* the CLI's — verified for real
  (child pid == printed pid, SIGTERM lands). Same class as the exit code:
  PowerShell needs an explicit `exit $LASTEXITCODE`, or a failed turn reports
  as done.

- **L-AT-4 — the honest UI was the hard part, not the plumbing.** The requested
  Windows default (`cmd`) is exactly the case where the CLI can't honour the
  choice for its own commands. A picker that just listed shells would have
  promised something the product cannot deliver, at the moment of the decision.
  The answer was a per-agent caveat under the **selected** row only —
  `native` vs `launch-only`, as a **code** crossing IPC (the copy lives in the
  renderer's i18n; main holds no strings). Under those two rows the sentence
  changes with the pick, which is the only version of it that is always true.

- **L-AT-5 — `join()` lied on Linux about Windows paths.** The Windows
  detection built candidates with `path.join`, which answers with forward
  slashes off Windows — so every Windows case in the unit suite failed against
  paths the code would never produce in production. `path.win32.join` is what
  makes a detector for a platform this suite can't run on testable at all.
  (The Claude CLI does the same thing internally — `require("path/win32")`.)

## Lessons (agent-onboarding, 2026-08-09)

M17 shipped on `feat/voice-prompt`. `npm run verify` green: **2548 tests /
159 files** (from 2499 / 157), 0 lint errors, every coverage gate passing.
Visual pass: 24 selectors x 5 states x 3 themes, all PASS. E2E contrast:
3/3 new tests green against the real Electron app.

- **L-AO-1 — the report was "detection is flaky"; it was three separate bugs,
  none of them flaky.** "I installed the Claude Code CLI, restarted Hive, and
  it still says it isn't installed" reproduced deterministically once each
  cause was named: (a) a GUI-launched app inherits the session `PATH`, not the
  login shell's — measured here, `PATH=/usr/local/bin:/usr/bin:/bin` ENOENTs
  all three probes on a machine where all three run in a terminal; (b) on
  Windows — **the only platform with a published installer** —
  `CreateProcess` appends `.exe` and nothing else, so npm's `claude` /
  `claude.cmd` / `claude.ps1` trio is invisible; (c) even resolving
  `claude.cmd` isn't enough, because Node >=18.20/20.12 (CVE-2024-27980)
  throws `EINVAL` on a `.cmd` without a shell. Three fixes, one module
  (`cliEnv.ts`), applied once in `createProcessRunner` so git, BMAD, npm and
  the MCP probe inherit them.

- **L-AO-2 — the login-shell query is necessary and not sufficient.**
  `$SHELL -lic` recovers whatever the rc files export (nvm, linuxbrew,
  `~/.local/bin`) and that is genuinely most machines. It did **not** recover
  the `/mnt/c/...` entries on this WSL box, because WSL's Windows-`PATH`
  append is done for the interactive session, not by any rc file — and the
  only `claude` on this machine lives there. Verified by running the real
  `detect()` under a thin `PATH`: `available:false` before the WSL prefix was
  added, `available:true` with `2.1.226 (Claude Code)` after. **Ask the shell,
  then keep looking.**

- **L-AO-3 — never let a probe and a spawn disagree.** The fix went into the
  `ProcessRunner`, not into the availability probe. Repairing only the probe
  would have turned "not installed" into a worse bug: a card that says the
  agent is ready and a first turn that dies at spawn. For the same reason the
  installer treats `npm` exiting 0 as an *opinion* and re-probes before
  reporting success (`not-detected` is its own failure reason).

- **L-AO-4 — a second rule for the same file wins on the properties it names
  and inherits the rest.** The redesigned `.wb-agent-card-install` set
  `flex-direction: column` over an earlier rule that set `align-items: center`
  for a row. The old value survived and centred every line of the install
  block — invisible in unit tests, obvious in the first screenshot. When a
  rewrite changes a component's axis, delete the old rule instead of layering
  over it, and re-state `align-items`/`text-align` explicitly under a centred
  ancestor.

- **L-AO-5 — `page.goto` with only the hash changed does not reload.** The
  first visual pass reported three themes and measured one: the harness
  carried the theme in `#dark`/`#light`/`#hive`, and a hash-only navigation is
  same-document, so the init script never re-ran and the previous sweep's
  scene leaked forward. A query param (`?theme=`) forces a real navigation.
  This is the gate-screen counterpart to the M15 lesson about driving the
  theme through the real control — here there is no control to drive, because
  "Aparência" lives in the work UI.

- **L-AO-6 — a re-scan reports the machine; it must not overrule the user.**
  The first cut of "Procurar de novo" folded every detected agent into the
  enabled set, which silently switched back on an agent the user had just
  switched off two seconds earlier. Only agents that cross *from missing to
  found* are adopted now. The general form: an action that refreshes external
  state may add, but may never revert a choice made on the same screen.

- **L-AO-7 — don't buy a contrast assertion with a global install.** The
  natural place for the install states was `e2e/contrast.spec.ts`, following
  the M16 rule. Clicking "Instalar" there runs a real `npm install -g` on
  whoever's machine runs the suite. The E2E sweeps the picker's resting
  surface (three card shapes + the scan strip); the transient running/failed
  states are measured by `tools/visual/agent-setup.mjs`, which drives them
  from a mocked bridge and needs no npm. The M16 rule stands — a surface that
  appears on demand gets measured in the same commit — but *which* harness
  measures it depends on what pressing the button costs.

## Lessons (shortcut-scopes, 2026-08-08)

M16 shipped on `feat/voice-prompt`. `npm run verify` green: **2499 tests /
157 files** (from 2401 / 155), 0 lint errors, every coverage gate passing.
E2E contrast: 9/9 across the three themes.

- **L-SS-1 — a surface that only appears on demand is where contrast defects
  survive.** `e2e/contrast.spec.ts` sweeps every visible text node, which is
  exactly why it had never seen the shortcut picker or the profile sheet: both
  are closed in an idle work UI. Opening them first (the shape the dictation
  test already used) found **four** real failures on the first run, two of them
  *pre-existing* and nothing to do with this feature — `PADRÃO` on an enabled
  agent card at 3.56:1 (hive) and "Como instalar" at 4.05:1. The rule this
  generalizes: when you add a dialog or a sheet, add it to the sweep in the
  same commit, or nobody measures it until a human squints at it.
- **L-SS-2 — `--faint` is still not a text role, and it will keep trying to
  be.** Third milestone in a row (M12, M12.1, M14's L-TI-1). This time it was
  the picker's group headings (4.18:1) and the profile's "Nenhum" count
  (4.18:1). Both wanted to be *quieter*, and both got there by weight and size
  instead — the empty count is `--muted` at weight 500, not `--faint` at 650.
- **L-SS-3 — a DS component can be broken in exactly one theme, and the token
  layer is where to fix it from the app.** `.hds-badge-muted` ships a hardcoded
  `rgba(38, 10, 18, 0.4)` — the brand's bordo at 40%, correct on the marketing
  site's bordo ledger and a mid-gray fill over a white dialog, where its own
  `--muted` text measures **2.35:1**. Fixed in `assets/theme.css` (an
  ink-derived `color-mix`, loaded after `ds-bundle.css`) rather than in the DS,
  because the component's dark rendering is protected by DESIGN.md's
  Dark-Truth Rule and the app is the consumer that needs it theme-resolving.
  App-wide fix, zero blast radius on the marketing site.
- **L-SS-4 — coral text is safe on `--bg` and unsafe on a tint.** Both
  pre-existing failures were `--accent` sitting on a surface that had *already*
  been tinted with the same accent; the ratios compound downward. The DS's
  `SegmentedControl` had documented the fix a milestone earlier and nobody had
  generalized it: an **opaque** tint carries the meaning, `--ink` carries the
  text. Applied to `.wb-agent-card-default`; `.wb-agent-install-link` kept its
  coral border and arrow and moved only the 12px label to ink.
- **L-SS-5 — measure the footer, don't estimate it.** The picker's footer gained
  a per-scope "Restaurar padrão do papel" and started wrapping. Two rounds of
  arithmetic-by-eye (shorten the studio link, widen the dialog 640→680) both
  missed by single-digit pixels; one `getBoundingClientRect` sweep gave
  164+138+209+100 against 632 of content and settled it in one shot.
- **L-SS-6 — the `git stash` warning from L-TI-4 is real, and I did it anyway.**
  Answering "did I break these two E2E specs?" needed a baseline, and `git
  stash push -u` was reached for out of habit. It survived (the pop was clean)
  but it briefly emptied a working tree holding ~25 modified files mid-feature,
  and the answer — both specs fail identically on the baseline — was available
  from `git worktree add` at the same cost and none of the risk.

## Lessons (mcp-logs, 2026-08-07)

M15 shipped on `feat/voice-prompt`. `npm run verify` green: **2401 tests /
155 files** (from 2262 / 152), 0 lint errors, every coverage gate passing.
Design system: 670 tests, typecheck clean.

- **L-ML-1 — a corpus test over real logs is worth more than any number of
  hand-written fixtures.** The classifier was written from a sample of the
  CLI's log lines and looked complete. `mcpLogCorpus.test.ts` — which runs the
  table over whatever real `~/.cache/claude-cli-nodejs/**/mcp-logs-*` files
  exist on the machine and fails past 2% unclassified — reported **30%** on the
  first run. Among the misses: `Connection failed after 30000ms: …` (my regex
  only matched the untimed `Connection failed: …`), so a genuine connection
  *failure* was being filed as a `debug` notice and rendered grey. Every
  hand-written fixture agreed with the code because the same person wrote both.
  The corpus did not.
- **L-ML-2 — `--faint` failed the light theme again, in a new module.**
  L-TI-1 recorded this exact lesson for M14 and it still shipped here: the
  timestamp, the category, the session band and its count all went to `--faint`
  because they are metadata. Measured **2.95:1 on light**. The rule is now
  simple enough to apply without measuring first: **`--faint` is for icons and
  inactive marks; anything a user reads is `--muted` or darker.** Size and
  weight carry the hierarchy.
- **L-ML-3 — the visual pass measured the same theme three times and reported a
  clean sweep.** The first contrast run switched themes by writing
  `localStorage` and reloading — but `boot.mjs`'s init script re-pins the theme
  on *every* navigation, so all three passes measured dark. It reported PASS
  with six real light-theme failures on screen. The probe now drives the app's
  own appearance menu. **A visual harness that sets state the harness itself
  owns is measuring its own default.**
- **L-ML-4 — a contrast probe that can't read `oklch()` reports a pass, not an
  error.** `getComputedStyle().color` returns `oklch(...)` verbatim for tokens
  authored in it (`--danger-ink`, `--success`), and the regex-based parser
  returned `null` and skipped the sample — silently, so the error row and the
  level dots were never measured at all. Sampling by painting one canvas pixel
  reads every colour syntax the browser accepts. **A skipped sample and a
  passing sample look identical in a report; make skips loud.**
- **L-ML-5 — the `*-ink on *-bg` token pairing does not survive small bold
  text.** The error tallies (status bar, and the DS `SegmentedControl`'s toned
  count) sat at 3.91:1 and 4.44:1. `--danger-ink` is too close in luminance to
  `--danger-bg` in both dark and light, and the status badge got worse still
  when the cluster's pressed tint composited underneath. Both moved to an
  **opaque** `color-mix(… var(--danger) 26%, var(--surface))` fill with `--ink`
  text: the tone carries the meaning, the number stays legible, and the badge
  no longer depends on what it happens to sit on.
- **L-ML-6 — a service method named `watch` shadows `import { watch } from
  'fs'`.** Inside `McpLogService.watch`, the unqualified `watch(...)` resolved
  to the service method, so the watcher recursed into itself and every
  `FSWatcher` was actually a disposer function — `watcher.close is not a
  function` at teardown. Caught by the unit test, invisible in the app (the
  first sweep still fired). Aliased to `watchPath` at the import.
- **L-ML-7 — two of my own tests passed while proving nothing.** A `vi.spyOn`
  on `fs.watch` never intercepted (the module binds the named import at load),
  so the "falls back when recursive watching is unsupported" test exercised the
  *normal* path and passed; a `vi.spyOn(fs.promises, 'stat')` never intercepted
  the service's `fs/promises` import either, and the test asserted only
  `not.toThrow()`. Both were found by reading the coverage report rather than
  the test results — **the uncovered lines were inside the branch the test
  claimed to cover.** Fixed with a real seam (`watchFactory`, injected like
  `probe`/`processRunner`) and a real filesystem condition (a dangling symlink:
  `readdir` lists it, `stat` throws).
- **L-ML-8 — the class-name collision was caught by a test, not by the eye.**
  The toolbar and the duration bar both used `wb-mcplog-bar`, so the meter's
  `display: block; width: 76px` was overriding the toolbar's flex layout. The
  component test asserting "no meter on a connection row" failed because
  `querySelector('.wb-mcplog-bar')` matched the header. Renamed to
  `wb-mcplog-meter`.
- **Known, accepted:** the console reads the CLI's cache directly, so a
  workspace whose agent is *not* Claude Code shows an empty console with the
  teaching state. That is honest — there are no MCP logs for it — but the copy
  does not yet say "this agent doesn't write MCP logs". Revisit when a second
  adapter grows MCP support.

## Lessons (turn-instrumentation, 2026-08-06)

M14 shipped on `feat/voice-prompt`. `npm run verify` green: **2172 tests /
149 files** (from 2118 / 146), 0 lint errors, coverage gate passing.

- **L-TI-1 — `--faint` is not a safe text role on the light theme, and the
  visual pass is the only thing that says so.** The step clocks and the meter's
  stats shipped in the tertiary role because they are metadata. Measured:
  **4.53:1 on dark** (barely over the floor) and **3.29:1 on light** — a clear
  fail. Four more failures in the context sheet came from the same cause:
  `--faint` clears its floor against `--bg`, not against the raised `--surface`
  a popover sits on (4.18:1 measured). All six moved to `--muted`. The
  hierarchy survives through size and the separator dots; the colour was never
  the only channel carrying it. `tools/visual/timing-contrast.mjs` sweeps 25
  selectors per theme and is what found them.
- **L-TI-2 — a unit test caught a duration that lied.** `formatDuration(999)`
  rendered `1,0s` — rounding, inside the branch that exists *because* a second
  hasn't passed, and a different string from the `1s` the next branch prints
  for 1000 ms. Floored instead. Worth writing down because it is the shape of
  every formatting bug: the edge of a branch, where the two branches disagree.
- **L-TI-3 — the real-Electron E2E caught a defect no jsdom test could.** The
  CLI names the model on its `assistant` messages and **not** on the `result`
  line that closes the turn. Taking each report at face value meant the
  authoritative one *erased* the model name a moment after showing it. Only a
  test driving a stand-in binary that speaks the real wire shapes could surface
  that — a hand-written event in a unit test carries whatever fields the author
  remembered. `applyUsage` now carries the last known model forward; the
  regression is pinned in `sessionUsage.test.ts`.
- **L-TI-4 — `git stash` is the wrong tool for "is this failure pre-existing?"**
  It was used once here to compare against the baseline and it emptied the
  working tree of an in-progress feature; the pop restored it, but the risk was
  never worth taking. `git worktree add /tmp/x HEAD` with `node_modules`
  symlinked in costs one build and touches nothing. That is how both suspect
  E2E failures were confirmed pre-existing (they fail identically on `HEAD`).
- **L-TI-5 — the React lint rules now forbid `Date.now()` during render and
  synchronous `setState` in an effect**, which rules out both obvious ways to
  seed a live clock. The resolution is a plain interval writing state, with the
  staleness *designed around* rather than papered over: the shared clock can lag
  a turn's start by up to one tick, so every consumer clamps elapsed at zero and
  the worst case is a turn reading `0s` for half a second after it started —
  which is what a stopwatch shows then anyway.
- **Known, accepted:** while a dictation take is open *and* a turn is running,
  the Stop control is not on screen — the `DictationBar` takes the toolbar row
  by the design system's `toolbarOverlay` contract ("alternatives, not layers",
  D-VP-7), and Stop lives in that row. `Esc` ends the take and brings it back.
  A narrow combination with a one-key recovery; noted rather than fixed,
  because the alternative is a second home for the interrupt.

## Lessons (voice-prompt — implementation, 2026-08-05)

M13 shipped T1–T17 on `feat/voice-prompt` (branched off `feat/second-brain`,
neither merged). `npm run verify` green: **2118 tests / 146 files**, 0 lint
errors, coverage gate passing.

- **The planned test baseline was stale, and nobody would have noticed.**
  spec.md's VP-R7.1 said "no regression against 1570 tests" — M12's number,
  written before `feat/second-brain` grew. Measuring the real branch base
  (`59bfbca`) in a clean worktree took four minutes and gave **1959 / 135**.
  A regression gate against a number 389 tests stale is not a gate. **Measure
  the baseline at the start of the feature, not at planning time.**
- **Four defects the tests caught that review would not have**, all in the same
  family — state that outlives the render that produced it:
  1. `capture.onTick` is registered **once**, so a `publishPhase` closing over
     `engine.phase` freezes at whatever the phase was when capture opened — and
     the phase that matters most, the 51 s warm-up, always arrives *after*
     that. Mirror ref, with its own test.
  2. A capture that resolves **after** the user discarded re-opened the
     microphone. Fixed with a take-generation counter checked in every async
     continuation.
  3. In the transcription queue, once the write gate passes a **failed**
     segment its slot is gone — so a successful retry had no slot to wait for
     and was written *nowhere*. Retried segments are released at the caret.
  4. `joinTranscript` handled only the left seam, so dictating in front of
     existing text welded onto it ("Oláabc").
- **The segmenter's noise floor cannot bootstrap from "silence" ticks.** The
  first cut calibrated the floor from ticks *classified as silence*; in a room
  with any real noise the very first tick already reads as speech, so nothing
  ever teaches the floor and the gate stays open forever. Tracking the minimum
  instead — instant downward, glacial upward, seeded by the first tick — needs
  no bootstrap and no blocking calibration window in front of the microphone.
- **Two lint rules paid for themselves and should be trusted, not worked
  around.** `max-lines-per-function` caught `useDictation` at 202 lines and the
  split it forced (`useDictationSink`) is the better design — it is the same
  audio/text seam the task list itself drew. And the rule against synchronous
  `setState` in an effect was right: the phase now settles through the queue's
  own change callback, which is a subscription to an external system and is
  where React wants that `setState` to live.
- **The visual pass found two defects again, and again neither was reachable by
  a test** (the M12 and M12.1 pattern, now three for three): the meter's
  "no signal" state rendered as a *dotted* rule rather than a flat line — and
  collapsing the gap was not enough, because a 2px bar with full pill rounding
  notches itself away from its neighbour — and the E2E seam stood in for only
  two of `Capture`'s three channels, so the meter looked dead while the take
  was plainly live. **Institutionalized:** `contrast.spec.ts` now opens a take
  and sweeps with the transport on screen in all three themes, because the
  existing sweep only ever sees an idle work UI.
- **⚠️ The Playwright MCP was not connected in this session.** The pass ran on
  the installed Playwright library instead — same browser, same init-script
  injection (`tools/visual/boot.mjs`), same contrast math. Worth knowing that
  the recipe in `docs/visual-validation.md` works either way; the MCP is a
  convenience, not a dependency.
- **`prettier`/`eslint` note that cost a cycle:** this package has **no
  jest-dom**. Renderer component tests assert on plain DOM
  (`el.textContent`, `getAttribute`), unlike `design-system/`, which does have
  it. Writing `toBeInTheDocument()` in a renderer test fails with "Invalid Chai
  property", not with a helpful message.
- Feature shape, for whoever wires the next field: `dictation/` is
  Chat-agnostic and `moduleBoundaries.test.ts` now enforces that it imports
  nothing from `chat/`. Adding dictation to "Perguntar à base", a commit
  message or search is `useComposerDictation({ value, setValue, textareaRef,
  engine })` plus rendering `<DictationBar>` in a `toolbarOverlay`.

## Lessons (voice-prompt — T1 spike: the capture path and the real Whisper clock, 2026-08-04)

Measured in the **real built Electron app** (`out/main/index.js` launched with
Playwright's `_electron`), its real CSP, its real `hive-model://` model store and
its own built Transformers.js chunk. Audio input was Chromium's fake device fed a
real speech WAV (`--use-fake-device-for-media-stream --use-file-for-fake-audio-
capture=…`), so every number is against actual signal, not silence.

- **OQ1 — CLOSED, YES. `new AudioContext({ sampleRate: 16000 })` really
  delivers a 16 kHz graph with a live `getUserMedia` source attached.**
  `ctx.sampleRate === 16000`, `state === 'running'`, `baseLatency` 11.6 ms —
  while the *track* itself negotiated 48 kHz (`getSettings().sampleRate: 48000`).
  The graph resamples on the way in, correctly. **Consequence: the design's
  `OfflineAudioContext` per-segment resample fallback is NOT needed** — the
  16 kHz PCM Whisper wants comes straight out of the graph. (Note for
  `micCapture.ts`: the `MediaStreamAudioSourceNode` reports
  `channelCount: 2` even with `channelCount: 1` requested and honoured on the
  track — read channel 0 and do not assert on the node's channel count.)
- **OQ2 — CLOSED, YES. `audioWorklet.addModule()` loads a same-origin worklet
  asset under this app's CSP from the `file://` renderer.** No CSP change is
  needed (`script-src 'self'` covers it, the same way it covers ORT's `.mjs`
  glue — the M12 T2 lesson generalizes). Measured cadence at 4 render quanta per
  tick: **63 ticks in 2006 ms = 512 samples / 32.0 ms**, exactly the tick rate
  `segmenter.ts` is specified against, with real signal (peak RMS 0.56).
  `ScriptProcessorNode` also worked (61 ticks / 2007 ms) but is **not needed** —
  `AudioWorklet` is the path, the deprecated fallback stays unbuilt.
- **⚠️ The audio graph's clock is starved under `xvfb-run`.** The identical run
  headless produced **1 tick in 2 s** (worklet) and 3 (script processor) instead
  of 63 — the render quantum is driven by the output device, and under xvfb
  there is none. `ctx.state` still reads `'running'`, so nothing errors; the
  audio simply does not flow. **This is why T15's E2E must fake capture at a
  seam** (as `tasks.md` already prescribes) — an E2E that pushes real audio
  through a real `AudioContext` cannot work in this environment. For manual
  runs, use the WSLg display (`DISPLAY=:0`, WSLg exposes a real PulseAudio
  sink + an `RDPSource` mic) instead of xvfb.
- **OQ3 — CLOSED with numbers. Streaming stays on WASM. The cost per segment is
  ~3.5–4 s and it is essentially INDEPENDENT of segment length**, because
  Whisper pads every window to 30 s. Same machine, `base`/fp32/WASM,
  `numThreads: 1`, no WebGPU adapter (`requestAdapter()` → null even on WSLg):

  | Audio | Wall clock | RTF |
  | --- | --- | --- |
  | 2 s segment | 3441 ms | **1.72×** |
  | 5 s segment (first) | 4055 ms | **0.81×** |
  | 5 s segment (repeat, warm) | 3715 ms | **0.74×** |
  | 11 s take | 3948 ms | **0.36×** |

  At 5 s per segment the RTF is **0.74×**, comfortably under the design's 1.5×
  fallback bar — so **D-VP-2's streaming premise holds on the guaranteed WASM
  path and the "single end-of-take segment" fallback is NOT taken.** The real
  lesson is the flat cost: **a segment shorter than ~4 s of speech costs the
  same as a 4 s one**, so short segments are what make the queue fall behind,
  not long ones. `minSpeechMs` is therefore a *throughput* control as much as a
  "don't cut on a breath" control — raised **1200 → 2000 ms** in `design.md` §2
  on this evidence. `maxSegmentMs: 15000` is confirmed safe (11 s cost 3.9 s).
- **The pipeline warm-up is the real wait: 51065 ms (51 s)** to build the ONNX
  session, with the model already on disk and the library import costing 32 ms.
  This is the single measured fact that validates **D-VP-5** (capture starts
  immediately, audio is buffered) and **D-VP-6** (pre-warm on
  `pointerenter`/`focus`): a 51 s gate in front of the microphone would make the
  feature unusable, and pre-warming on intent is what hides it. A second
  `transcribe()` on the cached pipeline paid none of it.
- Caveat, stated rather than hidden: the fixture is English speech
  (`jfk.wav`), so the pt-BR runs transcribe it as nonsense ("E então, meus
  amigas felos americanos") — expected, and irrelevant to the timings, which is
  what OQ3 asked. Wall clock was materially the same for `language: 'portuguese'`
  (3715 ms) and `'english'` (3489 ms) on the same 5 s audio. The `base` fp32
  model was already in the store from M12, so the first-download time was not
  re-measured here (M12 already owns that path).

## Lessons (second-brain — ask + cadence increment, 2026-07-27)

- **`npm run format` is `prettier --write .` — it rewrote 200 files outside the
  change** (the vendored `.claude/skills/**`, every `.specs/**` doc, `.scratch/`).
  Same shape as the `git add -u` lesson below: repo-wide tooling doesn't respect
  the unit of work. Reverted with a scoped `git checkout --` and used
  `npx prettier --write "src/**/*.{ts,tsx,css}"` instead. Check
  `git status --short | grep -v '^ M src/'` after any repo-wide command.
- **Four defects the tests could not have caught, all found by looking at the
  running app** (the M12 lesson repeating, so it is worth institutionalizing the
  visual pass rather than treating it as a formality): (1) the healthy health
  card repeated the action row's "Revisar" as its own CTA — one affordance
  pretending to be two, 60px apart; (2) secondary text on the accent-tinted CTA
  measured **3.93:1** (hint) and **3.46:1** (key cap) in **light** theme — both
  below the 4.5:1 floor, invisible to any test and to the eye until measured;
  (3) the ask surface's no-vault guard reused the ingestion sheet's copy and told
  the user to come back "para ingerir" when they had asked a question; (4) in a
  dragged-narrow rail the due-state buttons squeezed "Revisar agora" onto two
  lines inside its own button.
- **Sample pixels, don't trust `getComputedStyle().color` parsing.** A
  `color-mix()` value comes back as `color(srgb 0.75 0.71 0.71)` — floats in
  0–1, not `rgb(0-255)`. A naive contrast probe read those as near-black and
  reported 1.1:1 in dark and 13:1 in light for the *same* declaration. Both
  numbers were nonsense; the parser has to branch on the `color(` form. This is
  the general-purpose version of the M12 "sample real pixels" lesson.
- **A component that self-gates on `null` keeps branches out of its caller.**
  `WorkUI` was already at the lint's complexity ceiling (15); making `HealthNudge`
  return `null` unless `health.due` — the shape `VaultHealthCard` already had —
  removed the caller's ternary entirely instead of extracting a helper.
- **A DS mock that ignores `open` becomes a liability the moment a second
  dialog mounts.** `WorkUI.test.ts`'s `Dialog` stand-in always rendered, which was
  invisible while the guards were the only Dialog consumers and broke nine tests
  the moment "Perguntar à base" joined the tree (`Found multiple elements with
  the role "dialog"`). Mocks should honor the prop the real component honors.

## Lessons (second-brain — implementation, 2026-07-26)

- **Three real defects were found by tests I wrote to describe intent, and one
  more by looking at the running app — none by the type checker.** Worth
  recording because each was a silent-failure class:
  (1) `whisperModelStore.download()` looked up the catalog entry *outside* its
  `try`, so an unknown model id **rejected the promise** instead of emitting the
  `error` event every other failure emits — an unhandled rejection at the IPC
  layer. (2) `useWhisper`'s download used the `unsubscribe` handle inside the
  callback that assigns it, which is a **temporal-dead-zone crash** the moment
  the callback fires synchronously (an already-complete download, or any future
  in-process implementation). (3) `whisperProtocol`'s escape guard: literal
  `../` is normalized away by `new URL()` itself, so the guard only earns its
  keep against **percent-encoded** `%2e%2e%2f`, which survives parsing and is
  decoded afterwards — the test had to be corrected to assert the real attack
  shape rather than the one that can't happen. (4) The visual pass caught the
  sidebar pane header still reading "Arquivos" on the new view, and `index.md`
  listed twice (a dedicated "Índice" row plus the tree) — neither visible from
  any test.
- **A gate step that shells out to a network-backed CLI needs an escape hatch
  while it is RUNNING, not just after it errors.** The second-brain provisioning
  step re-runs on every workspace switch; without a "Continuar mesmo assim"
  during the wait, a stalled network parks the user on a spinner indefinitely.
  Generalizes to any blocking gate over an operation that can hang rather than
  fail.
- **Four of the repo's E2E specs (file-management, explorer-editor-ux ×2,
  workspace-switching) fail in this sandbox waiting on the BMAD provisioning
  CLI — confirmed PRE-EXISTING, not an M12 regression**, by checking out the
  branch base (`ae5551e`) into a clean worktree, building it, and running
  `file-management.spec.ts` there: it fails identically, at the same
  `waitForWorkUI` timeout. Worth doing rather than assuming in either direction
  — the symptom (work UI never appears) looked exactly like something M12's new
  gate step would cause, and reasoning alone would have pointed the wrong way.
  `second-brain`, `agent-change-review` and `app-launch` specs all pass.
- **`git add -u` stages the whole repo, not the directory you're working in.**
  During a commit amend it swept 1075 unrelated repo-root deletions (pre-existing
  BMAD/scratch clutter) into an M12 feature commit. Caught by diffing the branch
  against its base and counting files outside `hive-desktop/`; fixed with a
  restore commit, leaving the user's uncommitted deletions exactly as found.
  This is the same "scope to the release unit" lesson npm-distribution already
  recorded for `scripts/release.mjs` — it applies to interactive git too. Verify
  a feature branch with `git diff --name-only <base>..HEAD | grep -v '^<dir>/'`
  before declaring it clean.
- **The HF tree API is not optional cleverness for the model downloader.**
  `onnx-community/whisper-large-v3-turbo` ships the **external-data** format:
  `encoder_model.onnx` is a **0-byte stub** and the real 2.4 GB lives in
  `encoder_model.onnx_data`. A hard-coded two-file list would "succeed" and then
  fail at session-create with a confusing error. Catalog sizes are likewise
  measured from the live API rather than estimated.
- **A `.tsx` that exports a non-component trips `react-refresh/only-export-
    components`** — hit three times here (`phaseCaption`, `formatElapsed`,
  `recommendationCopy`), each resolved by moving the helper to its own `.ts`
  (the `gitStatus.ts` precedent). Worth reaching for the separate module
  immediately rather than waiting for lint.

## Lessons (second-brain — T1 spike: real `skills` CLI, 2026-07-25)

- **T1 — OQ1 CLOSED against the real, live vercel-labs `skills` CLI
  (`npx -y skills`, 2026-07-25).** Ran the real install/update in throwaway
  git-init'd workspaces. Confirmed:
  - **The `skills` CLI auto-detects the agent and installs non-interactively**
    when a coding agent is present — first stdout line is
    `●  claude-code_<ver>_agent  Agent detected — installing non-interactively`.
    No pty-driving needed (like BMAD's B1). `-y` still passed for safety.
  - **DIVERGENCE from design.md §2's literal command, resolved by the spike
    (its whole purpose):** the `nicholasspisak/second-brain` repo ships **four
    separate skills**, not one skill with sub-skills — `second-brain` (the
    onboarding wizard), `second-brain-ingest`, `second-brain-lint`,
    `second-brain-query` (exactly the four `/second-brain*` commands the spec's
    acceptance criteria require). design.md §2's `--skill second-brain`
    (singular) installs **only 1 of 4**, which would leave ingest/query/lint
    undiscoverable (breaks SB-R2.4/R6.1). The design's spike box already
    anticipated "SKILL.md + the four sub-skills", so this is the imprecise-flag
    the spike was meant to pin, not an approach change. **Correct install
    command (T3 uses this):**
    `npx -y skills add https://github.com/nicholasspisak/second-brain --skill '*' -a claude-code -y`
    (cwd = workspace) → installs all four to `<ws>/.claude/skills/<name>/` (copy,
    not symlink) + writes `<ws>/skills-lock.json`. `--all` was rejected (it forces
    `--agent '*'`, installing to every agent, not just claude-code).
  - **Update subcommand exists and is distinct** (design OQ1's open question):
    `npx -y skills update -p -y` (`-p` = project scope, `-y` = skip scope
    prompt). Updates every skill in `skills-lock.json` — which contains exactly
    our four (BMAD does NOT use this CLI, so no cross-contamination). Verified it
    re-syncs all four. Preferred over re-running `add` (design's fallback).
  - **Detect marker:** `<ws>/.claude/skills/second-brain/SKILL.md` (present after
    install), analogous to BMAD's `_bmad/_config/manifest.yaml`.
  - **Stdout markers for the line-buffered parser (ANSI/spinner-stripped):**
    _add_ → `Agent detected`, `Found <N> skills`, `Installation complete`,
    `Installed <N> skill(s)`, per-skill `✓ <name> (copied)`, `Done!`;
    _update_ → `Checking for skill updates…`, per-skill `✓ Updated <name>`,
    `✓ Updated <N> skill(s)`. Errors surface as non-zero exit + `error`-bearing
    lines. Fixtures captured for `secondBrainService.test.ts`.

## Lessons (second-brain — T2 spike: Transformers.js under the Electron CSP, 2026-07-25)

- **T2 — OQ2 + OQ3 CLOSED. A real, correct transcript came out of a
  local-only ONNX Whisper model, no network, under the renderer CSP, served
  by a custom `hive-model:` protocol, on the WASM/CPU path (2026-07-25).**
  Built a throwaway Electron harness (scratchpad, not committed): a
  `sandbox:true` BrowserWindow loading a `file://` page with the design's
  target CSP, a `hive-model:` protocol serving a hand-placed
  `Xenova/whisper-tiny` model dir, `@huggingface/transformers` (installed as a
  real dep) bundled with esbuild (`--platform=browser --conditions=browser`),
  transcribing the 11 s `jfk.wav`. Output: *"And so my fellow Americans ask not
  what your country can do for you ask what you can do for your country."* —
  the correct JFK line. ~50 s total (model load + inference), single-thread
  WASM, run under `xvfb-run` with `ELECTRON_RUN_AS_NODE` stripped (the T2-era
  gotcha). **The spike surfaced FOUR corrections to design.md that T11 must
  bake in — none change the approach (D-SB-1 holds), they pin the exact
  config:**
  1. **`hive-model:` needs `corsEnabled: true` in its privileged-scheme
     registration** (design §4.3 listed only `standard/secure/supportFetchAPI/
     bypassCSP:false`). The renderer is a `file://` origin; a `fetch()` from
     `file://` to a custom scheme is refused by Chromium ("Cross origin
     requests are only supported for protocol schemes: chrome…, http, https")
     **unless the scheme is CORS-enabled**. Full privilege set that worked:
     `{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true,
     stream:true, bypassCSP:false }`.
  2. **The scheme is HOST-based, not path-based.** A `standard` scheme
     normalizes `hive-model:///models/x` → **host=`models`**, path=`/x` (the
     first segment becomes the URL authority). design §4.1's
     `env.localModelPath='hive-model:///'` is wrong — the repo owner (`Xenova`)
     would silently become the host. Use `env.localModelPath='hive-model://models/'`
     and have `protocol.handle` resolve **`new URL(req.url).hostname` as the
     store-root key + `.pathname` as the rest** (path-escape-guarded). The T11
     handler serves `userData/whisper-models/` as the `models` host.
  3. **ORT WASM assets are SAME-ORIGIN app bundles, NOT served via
     `hive-model:`.** ORT loads its `ort-wasm-simd-threaded*.mjs` glue by
     dynamic `import()` — a **script** load governed by `script-src`, not a
     `connect-src` fetch. Serving it from `hive-model:` fails ("Failed to fetch
     dynamically imported module"). Point `env.backends.onnx.wasm.wasmPaths` at
     a **same-origin** URL (the app bundles the `onnxruntime-web/dist/ort-wasm-
     simd-threaded.*` `.mjs`+`.wasm` next to the renderer; `script-src 'self'`
     covers it). This *confirms* design §4.4's CSP was right to put only
     `hive-model:` in `connect-src` (models) and nothing extra in `script-src`
     beyond `'wasm-unsafe-eval'`. T11 must copy the ORT assets into the renderer
     build output (a vite `publicDir`/copy step) and set `wasmPaths` to them.
  4. **On WASM, `dtype` must be `fp32`, not `q8`.** design §4.1's
     `dtype: device==='webgpu'?'fp32':'q8'` fails on the WASM path: the
     uint8-`quantized` (and `q4`) Whisper **decoder** uses a `MatMulNBits` op
     onnxruntime-web's WASM build can't create ("qdq_actions.cc … Missing
     required scale … TransposeDQWeightsForMatMulNBits"). `fp32` transcribes
     cleanly. **Consequence for the T12 catalog + model store:** the WASM path
     downloads the **fp32** ONNX files (tiny decoder is ~118 MB fp32 vs ~30 MB
     quantized), so the catalog's `sizeMB` must reflect fp32, and
     `downloadModel` must fetch `encoder_model.onnx` +
     `decoder_model_merged.onnx` (not the `_quantized` variants) for the WASM
     default. WebGPU may accept q8/fp16 — kept as a per-device `dtype` choice
     (fp32 on wasm, fp32/fp16 on webgpu), but the **guaranteed** path is
     fp32/WASM. (WebGPU itself was NOT validated — `navigator.gpu` is truthy
     even headless, but no real adapter exists under xvfb; the WASM fallback is
     the load-bearing path and it works, exactly as the design intends.)
  - Also: **`env.useBrowserCache = false`** (the Cache API can't store a
    `hive-model:` response — "Request scheme 'hive-model' is unsupported"; our
    `userData` model store *is* the cache, so browser caching is redundant
    noise). Plus `env.allowRemoteModels=false` + `env.allowLocalModels=true`.
  - Verified `net.fetch(pathToFileURL(file))` inside `protocol.handle` streams
    local model bytes correctly. The HF **tree API**
    (`/api/models/<repo>/tree/main` + `/tree/main/onnx`) returns the file list
    unauthenticated (de-risks T12's `downloadModel`); model files fetch from
    `https://huggingface.co/<repo>/resolve/main/<path>` with a plain `curl`.

## Blockers

- **ND-B2 — OPEN (2026-07-22), blocks the real payload publish only.** Need a
  GitHub token (`gh auth login`, or a PAT with `repo`/`contents:write` on
  `gustavobrunodev/hive`) to create a real GitHub Release and upload assets —
  no `gh` CLI installed and no token available in this environment. The read
  side (resolving a release by tag, downloading an asset) needs no auth at
  all for a public repo — already verified live, nothing blocks building or
  testing that half. The main npm package publish is unaffected (ND-B1
  already resolved, that login still works).
- **ND-B1 — RESOLVED (2026-07-22).** User authenticated (`npm whoami` now
  succeeds); the real npm username is **`gustavobrunodev`** — not `gustavobgt`,
  the unconfirmed candidate context.md's discuss phase had merely checked
  availability for. Both `@gustavobrunodev/hive-desktop` and `@gustavobrunodev/
  hive-desktop-win-x64` verified free (HTTP 404) on 2026-07-22. `package.json`'s
  `name` and `hiveRelease.platforms['win32-x64']` updated from the
  `@npm-user-todo/...` placeholder to the real scope; `package-lock.json`
  regenerated. T17 (first real publish) is now unblocked; T18 (real-Windows
  E2E) still needs actual Windows hardware, unavailable in this WSL2 env.
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

- **M26.1 — the voice bugfix round (2026-08-23).** Six defects reported from a
  real session, all in M26's surfaces. What each one turned out to be:

  - **"Array buffer allocation failed" during transcription.** Measured in this
    app's own renderer, not inferred: `new ArrayBuffer(2040 MiB)` succeeds and
    `2047 MiB` throws with exactly that sentence — V8's **2 GiB per-buffer
    ceiling**. Transformers.js reads each weight file into one such buffer, so
    a model with any single file at or past 2 GiB **cannot be loaded on any
    machine**: `large-v3-turbo` fp32 ships a 2430 MB `encoder_model.onnx_data`
    and `large-v3` fp32 a 3458 MB one. Both were offered in the library with a
    download button — a 3.0 GB and a 5.8 GB download that end in a `RangeError`.
    `voice/modelFit.ts` now carries that ceiling plus a memory rule (the load
    peaks at `total + largest file`, and may claim at most half the machine),
    and `maxFileMB` joined the catalog, measured per repo per variant.
  - **The same failure was made twice as likely by a second bug.** Passing
    `progress_callback` to `pipeline()` makes Transformers.js v4 probe every
    expected file's metadata first, and for a **non-http** model path — which
    `hive-model:` is — that probe is a *full GET whose body it never reads*,
    just to look at `Content-Length`. Measured in the real Electron app: two
    requests per `.onnx`, one left hanging for the life of the window. On
    `medium` that is a 1.7 GB response held open, and an open file handle in
    main that Windows will not let the user delete the model through.
    `whisperEnv.installLoadMeter` replaces the option: it wraps `env.fetch` and
    counts bytes off the stream the library already reads. Same percentages,
    one request per file — verified end to end against the real protocol.
  - **q8-on-WASM re-verified, and it still fails** (`MatMulNBits … Missing
    required scale`, the T2 spike's finding, unchanged with ORT as bundled
    today). So there is no quantized escape hatch on a CPU-only machine; fp32
    is the only path, which is what makes the size ceiling load-bearing.
  - **A finished download did not move the model out of "Biblioteca".**
    `VoiceScope` never subscribed to `onDownloadSettled`. The transfer belongs
    to main and outlives the sheet, so the *ending* is the only thing that
    reaches the screen — and nothing was listening. The gate had the
    subscription; the settings screen did not.
  - **Deleting asked nothing and refreshed nothing on failure.** The undo for
    that button is a multi-gigabyte download, so it now confirms; and the
    re-read moved from `.then` to `.finally`, because a `remove` that throws
    part-way (Windows will not unlink a file the engine still holds) left the
    screen showing a model that was already half gone.
  - **The chosen-model rows were ragged.** `.hds-radio-item` sets
    `justify-content: center` — right for a 20 px disc, wrong for a row — and
    the M26 override never erased it, so each row's content floated in whatever
    width was left over: "Automático" (no trash button) sat 34 px right of the
    rows under it, and neither lined up with the library. Same lesson M17's
    agent-card block recorded: **a rewrite that changes a component's axis must
    ERASE the old rule, not stack on it.**
  - **The one item that was already correct: the microphone gate.** Verified in
    the real app with an empty userData — `whisper:preference` answers `id:
    null`, the mic opens the gate, and `getUserMedia` is never called. It is
    now covered permanently by `e2e/voice-model-gate.spec.ts`, which is the gap
    that let this reach a user: every unit test injects a fake preference, and
    `voice-prompt.spec.ts` was itself **red** on this branch because M26's gate
    blocks a userData with no model — the spec now seeds one.

  Gates: 3865 unit tests green (220 files), typecheck + lint clean (0 errors),
  E2E green (`voice-prompt`, `voice-model-gate`, `second-brain`), visual pass
  PASS in three themes over the blocked rows, the confirmation and the
  post-download refresh. Two design defects the visual pass caught that no test
  would have — see Lessons (visual).

- **git-management (M10) — COMPLETE (T1–T32), 2026-07-24.** The whole VS Code/
  Cursor-parity loop ships on `feat/git-management`: detect → status → stage/
  unstage/discard → commit (amend/stage-all/commit&sync) → diff (unified + side-
  by-side) → branches (create/switch/rename/delete + dirty guard) → remote sync
  (fetch/pull/push/publish, system credentials only) → history → conflict
  resolution → stash → ambient decorations (tree badges + editor gutter) + status
  bar, in a switchable Explorer⇄Source Control sidebar. One atomic commit per
  task, `npm run verify` green (**73 files / 1180 tests**, typecheck + 0 lint
  errors), per-file coverage gates held on every touched file. Real-Electron E2E
  (`e2e/git-management.spec.ts`) drives the built app against a throwaway repo +
  bare remote through flip→diff→stage→commit→sync(push)→stash asserting real
  git/on-disk state (passes ~5.6s). All SCM states visually validated dark+light
  via the Playwright-MCP window.hive-mock recipe
  ([[hive-desktop-visual-validation]]). Reusable lessons:
  - **A mock-boot visual pass needs the *whole* `window.hive` surface, not just
    `git`.** Booting the built renderer past onboarding means mocking every
    namespace App/WorkUI touch at startup (getWorkspace/isProvisioned/
    provisionState, profile.getAgents+getRole, `updateBmad` **must** fire
    `{type:'done'}`, plus workflows/skills/studio/mcp/chatHistory/app/shortcuts/
    fs). Seed `localStorage['hive.tourSeen']='1'` to suppress the first-run tour
    and `['hive-desktop-theme']` to pin the theme (a stale value persists in the
    browser profile). The `ConflictView` reads on-disk markers, so its file's
    `readFile` mock must contain real `<<<<<<< / ======= / >>>>>>>` blocks or it
    renders the (also-valid) "no conflicts, mark resolved" empty state.
  - **E2E must boot past the same gate chain + the guided tour.** Seed
    `config.json` with `agent`/`agents`/`role` to skip agent+role setup; the
    first-run tour overlay intercepts pointer events, so `click()` its skip
    button (auto-waits — don't race an early `isVisible`) and wait for `.wb-tour`
    hidden before driving the UI. The running app provisions untracked `_bmad/*`
    files, so a post-stash "clean tree" assert must be **path-scoped**
    (`status --porcelain -- README.md`), never a bare empty-status check.
  - **Store growth is a test-maintenance tax — centralize the fake.** Every new
    `useGit` action broke hand-rolled fake stores; a single
    `testSupport/gitStoreMock.ts createGitStore()` made adding a field a
    one-file change. Same for the bridge: `testSupport/hiveGitMock.ts`.
  - Original demoable-slice (T1–T20) lessons still hold:
  - **Machine-format git parsers must be captured from real `git`, not
    guessed.** Porcelain-v2 `-z` renames emit the entry line then the origPath
    as the *next* NUL field (consume two); numstat `-z` renames emit an empty
    path field then origPath+newPath as two NUL fields; binary numstat is
    `-\t-`. Captured 2.34.1 fixtures live inline in `gitParse.test.ts`.
  - **Never let a git op hang on a prompt.** Every `git()` call sets
    `GIT_TERMINAL_PROMPT=0` **and** `GIT_EDITOR=true` — the latter so
    `merge --continue` / any editor-opening commit concludes non-interactively
    against an absent tty (D-GIT-1 fail-fast).
  - **Commit message via a temp `-F` file, not `--file=-`** — the app's
    ProcessRunner closes stdin (`ignore`), so `-` would read an empty message.
  - **The eslint config (`react-hooks`) forbids BOTH setState-in-effect AND
    ref-read/mutate-during-render.** Resetting store state on a prop
    (workspace) change is cleanest as a **workspace-tagged state object** +
    pure derivation (`state.ws === workspace ? state : empty`) — no reset
    effect, no render-time ref. The eager initial load in an effect must be
    wrapped in `queueMicrotask(() => …)` so the plugin doesn't flag the async
    setState it can't see through.
  - **Radix DropdownMenu/ContextMenu don't open on click in jsdom** — mock the
    DS menu family (render content inline as `role=menu/menuitem` buttons),
    exactly like `Explorer.test`. DS `AlertDialog`/`Dialog` DO render in jsdom.
  - **Renderer git types are derived from the `window.hive.git` bridge**
    (`Awaited<ReturnType<Window['hive']['git']['status']>>`) — no cross-boundary
    import, matching the Chat.tsx mirror convention.
  - Exporting a non-component from a `.tsx` trips `react-refresh/only-export-
    components` — pure helpers (e.g. `toSplitRows`) belong in a `.ts` module
    (`gitStatus.ts`). Extract oversized pure functions to stay under the eslint
    complexity cap (parseStatusV2 → `applyBranchHeader`).

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
  renderer, ESM bundle + CSS both load without error. **Superseded/corrected
  2026-07-22** (see the npm-distribution Lesson below): `node_modules/@hive/
  design-system` is currently a real symlink, not a copy — verify with `ls -la`
  rather than trusting either note blindly, since this evidently can change.
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
- **npm-distribution — a parallel worktree-isolated subagent can fork from a
  stale `main` if the harness session restarts mid-orchestration (2026-07-22).**
  Three subagents were launched with `isolation: "worktree"` right after two
  commits landed on `main`; a session interruption/restart hit mid-flight, and
  on resume two of the three worktrees' branches were still anchored 4+
  commits behind current `main` (missing the very deps/spec-doc commits their
  own briefs depended on), while the third (launched last) was correctly
  based. Symptom was clean and easy to catch: `git worktree list`/`git log
  --oneline` on each worktree before resuming showed the mismatched base
  commit directly. Fix: resumed each stale agent via `SendMessage` with an
  explicit instruction to `git merge main` first (a trivial fast-forward,
  since none had diverged with commits of their own yet) before continuing —
  no work was lost, nothing needed re-doing. Lesson: after any interruption
  during multi-agent worktree orchestration, verify each worktree's base
  against current `main` before resuming or re-launching — don't assume the
  fork point is still current just because the agent was told to work from
  `main`.
- **A fresh git worktree of this monorepo needs `design-system` rebuilt before
  `npm run typecheck`/`test` will pass cleanly (2026-07-22).** Two independent
  subagents, in separate worktrees, both hit spurious `Badge`/`Logo` prop-type
  typecheck errors that don't reproduce on the primary checkout. `design-
  system/dist/` **is** git-tracked (not gitignored); `node_modules/@hive/
  design-system` is currently a real **symlink** to `../../../design-system`
  (confirmed via `ls -la` 2026-07-22 — this corrects the file-management-era
  T3 lesson above, which found `--install-links` copying instead; whichever
  npm/flag combination produced that has since changed or didn't apply here).
  Being a symlink, a worktree's own `npm install` in `hive-desktop/` resolves
  it relative to *that worktree's own* `design-system/` copy (correct — no
  cross-worktree leakage) — but that copy still needs its own `node_modules`
  installed (untracked, obviously) and, if its checked-out `dist/` predates a
  newer prop shape used elsewhere, a rebuild (`npm install && npm run build`
  inside `design-system/`) to actually reflect current source; no `hive-
  desktop`-side re-copy step is needed once it's a symlink; the two subagents'
  own `npm install` there was harmless but unnecessary. Both independently
  diagnosed and fixed this locally without it being a real product bug — worth
  telling any future worktree-isolated agent working in this repo to check for
  this class of false-positive before trusting a typecheck failure as real,
  and to verify with `ls -la node_modules/@hive/` rather than assuming
  symlink-vs-copy from an older note (including this one, later).
- **`electron-builder`'s `${name}` artifactName macro is the raw, unsanitized
  `package.json` name — not the sanitized `productName` (2026-07-22).**
  Scoping the npm package name (`@npm-user-todo/hive-desktop`, npm-
  distribution's T2) silently broke `electron-builder.yml`'s
  `nsis`/`dmg`/`appImage` `artifactName: ${name}-${version}...` templates: a
  literal `@`/`/` in the resolved filename made NSIS packaging fail ("Can't
  open output file"). Confirmed by reading `app-builder-lib`'s own source
  (`appInfo.js`'s `get name()` returns `this.info.metadata.name` verbatim;
  `macroExpander.js` substitutes `${name}` with exactly that, no sanitizing —
  contrast `sanitizedName`/`productName`, which route through
  `sanitizeFileName`). Fixed by switching all three templates to
  `${productName}` (already `hive-desktop` in this file), which produces the
  *identical* pre-existing filenames and needs no other change. Lesson: any
  future package-name change in a project using electron-builder should grep
  `electron-builder.yml`/`.json` for bare `${name}` in `artifactName`/
  similar templates — it does not track a scoped/renamed npm package name
  safely.
- **A DS `ToastProvider` that always renders its own default `ToastViewport`
  internally will silently steal a consumer's custom-positioned toast
  (2026-07-22, npm-distribution T15).** `UpdateNotice.tsx` composed
  `<Toast>`/`<ToastViewport className="wb-update-toast-viewport">` directly
  inside `@hive/design-system`'s `<ToastProvider>` (deliberately bypassing
  `useToast()`'s string-only API, per design.md §5.1) — the card rendered at
  the DS's shared bottom-right default instead of the intended bottom-left
  (above the rail gear), even though the custom viewport's own CSS
  (`position:fixed; left:...`) computed correctly *on that element*. Root
  cause: `ToastProvider`'s JSX always renders `{children}` then its own
  un-classed `<ToastViewport />` after them — Radix registers whichever
  `Toast.Viewport` mounts *last* as the active portal target, so the
  provider's own default (mounting after the custom one in the same
  provider) wins the race regardless of the custom one's styling being
  perfectly correct. Diagnosed by comparing `getBoundingClientRect()` of the
  custom viewport (correctly positioned, but empty) against the actual toast
  element's `parentElement` chain (nested under a *second*, unstyled
  `.hds-toast-viewport`) — a CSS-only inspection would never have caught this
  since the custom viewport's own styles were never wrong. Fixed with a new
  `viewport?: boolean` prop on the DS's `ToastProvider` (default `true`) that
  skips its internal default when a consumer supplies its own. Lesson: when a
  provider component unconditionally renders its own default of something a
  child might also render a custom instance of (a portal target, an
  overlay, a root), and mount order determines which "wins" via shared
  context, that default needs to be suppressible — verify this kind of
  composition by inspecting the *actual DOM parent* of the rendered content,
  not just the styling of the container you intended it to land in.
- **A conditionally-rendered "not yet available" UI element can hide the only
  action a user has, if the fallback case is "render nothing" instead of an
  explicit empty-state message (2026-07-22, npm-distribution T15).**
  `UpdateCenter`'s status line + its manual refresh `IconButton` were both
  gated behind `info?.lastCheckedAt != null` — correct once a check has ever
  run, but before the very first one (a fresh install, or the brief window
  before the launch check resolves) the *entire* line vanished, taking the
  refresh button with it: a user in that window had literally no way to
  trigger a check from this surface. Caught by deliberately testing a
  `lastCheckedAt: null` scenario during visual validation rather than only
  the "happy path" states. Fixed with a `neverCheckedLabel` fallback string
  so the line (and its button) always renders. General lesson: any UI
  element gated on "has this succeeded at least once" should default to an
  honest empty-state message, not disappear — especially when it's also the
  only entry point to the action that would resolve the gate.
- **A background subagent can be cut off mid-task by an account-level session
  usage limit, distinct from a crash or error (2026-07-21/22).** One of four
  parallel subagents in npm-distribution's renderer-UI phase stopped with
  `status: failed` and a message naming a session-limit reset time, mid-way
  through a file edit — its worktree held real, uncommitted, in-progress work
  (a new component + partial i18n/CSS edits), not corrupted or half-written
  garbage. Resuming it later via `SendMessage` (not a fresh `Agent` call, which
  would have started cold) picked up exactly where it left off and completed
  normally. Lesson: on a `status: failed` notification whose message names a
  usage/rate limit rather than describing a real error, check the worktree
  for salvageable progress before assuming anything needs to be redone, and
  prefer resuming the same agent over relaunching fresh.
- **A test file's own `stubHive`/mock convention can hide a race that a
  *product* bug and a *test-harness* bug look identical from the outside —
  verify against real computed DOM state, not just a screenshot, before
  concluding either way (2026-07-22, npm-distribution T15).** During visual
  validation, an "up-to-date" scenario appeared to show `UpdateCenter`'s
  version-block section completely empty. This looked like a real defect at
  first glance (identical symptom to the two real ones found in the same
  session), but inspecting the actual live state showed the component's own
  local `flow` state was stuck at `idle` — traced to the throwaway
  `window.hive` mock used for this manual validation pass storing only a
  *single* `onUpdateEvent` listener variable (overwritten by whichever of
  `useUpdateFlow`/`UpdateCenter` subscribed last), unlike the real preload's
  `ipcRenderer.on` which supports multiple concurrent listeners natively.
  Fixing the mock to use a `Set` (matching the real multi-listener contract)
  resolved it with no product code change needed. Lesson: don't fix product
  code in response to a mock-driven visual check without first confirming
  the mock itself faithfully matches the real API's concurrency/fan-out
  behavior, not just its call signature.
- **`App.test.ts`'s "advances from the update gate to the ready placeholder
  once updateBmad() reports done" test is flaky under full-suite parallel
  load, but not on its own (confirmed 2026-07-22, pre-existing — `App.tsx`/
  `App.test.ts` were untouched by npm-distribution).** Failed once with
  `AssertionError: expected undefined to be truthy` during a full `npm run
  test`/`verify` run; three consecutive isolated runs of just that file
  (`npx vitest run src/renderer/src/App.test.ts`) all passed cleanly. Not
  investigated further (out of scope, unrelated to any file this feature
  touched) — flagged here so a future session doesn't mistake a repeat of
  this specific flake for a real regression.

- **design-studio (M18) — COMPLETE (T1.1–T7.8), 2026-08-10.** 52 tasks, 7
  sequential phases, one atomic commit each, `npm run verify` green at **3346
  tests / 202 files** (from 2548 / 159 at M17), 0 lint errors. A UX Spec now
  opens as a `design-studio` tab, becomes navigable Telas rendered with real web
  components, is edited by Inspector/Tree/Chat, and exports a self-contained
  HTML Bundle. What the execution learned, beyond the decisions above:

  - **L-DS-1 — A tinted "selected" state is a contrast trap, and this is the
    third module to fall into it.** The DS paints a selected Tree row as
    `--selected` on `--selected-bg` — coral text over a coral tint, 4.44:1 in
    the dark theme. Same shape as the `SegmentedControl` count (M15) and the
    agent card's `PADRÃO` (M16). The fix is the same every time: an **opaque**
    fill carries the tone, `--ink` carries the text. Worth generalising: any
    `X` on `X-bg` pair is a failure waiting for a theme where `X` is dark.
  - **L-DS-2 — `--faint` again, fourth module.** It went onto the chat's status
    line as "metadata" and measured 3.29:1 in the light theme (M14's L-TI-1,
    verbatim). The rule that settles it is not about importance, it is about
    who reads it: **if someone reads the text it is `--muted` or darker;
    `--faint` is for icons and inactive marks.**
  - **L-DS-3 — A `flex: 1` child of a `ResizablePanel` gets nothing.** The
    panel is a *block*, so the bench sized to its content: the dot grid stopped
    a third of the way down the column and the stage read as ending in mid-air.
    Invisible in jsdom (no layout) and invisible in a component test (no panel).
    `height: 100%` is what a block parent understands.
  - **L-DS-4 — A teaching state inside a scaled device is not a teaching
    state.** The "this Tela has no Components" empty rendered inside the device
    frame, which at a Desktop preset on a real column is ~46% — so the one
    surface whose entire job is to explain arrived at 7px. Anything that must be
    *read* belongs outside whatever the viewport transform touches.
  - **L-DS-5 — A vendor override that is scoped by class leaks through
    anything not carrying the class.** `.hds-btn-primary` hardcodes a dark ink
    that measures 2.03:1 over the light theme's bordo `--accent`; the app had
    already retinted it, but only for `.wb-btn*`. A bare `<Button>` fell
    straight through. Scope such overrides by *container*, not by opt-in class.
  - **L-DS-6 — A modal `aria-hidden`s the app, and a contrast sweep skips
    `aria-hidden` subtrees.** Sampling right after the palette closed measured
    the palette and reported the Studio as covered: five samples, all green, all
    from the wrong surface. Two consequences, both now in the spec: wait for the
    modal to leave the DOM, and sweep a **subtree** — the sampler dedupes by
    (colour, ground, size, weight), so a surface built from the shell's tokens
    contributes nothing to a whole-window sweep and "covered" is unprovable.
  - **L-DS-7 — A tooltip on a focused trigger eats the first Escape.** Radix's
    Tooltip dismisses on Escape, so the keystroke a user aims at the dialog the
    button just opened goes to the tooltip instead. Only reproducible from the
    keyboard, which is exactly why the keyboard E2E exists. A text-labelled
    button does not need a tooltip repeating its own word.
  - **L-DS-8 — The claim jsdom could not make had to be carried for three
    phases.** T4.6 could only assert the *cause* of an honest preview scale
    because jsdom reports one fixed `innerWidth` for every frame; the effect was
    finally measured in T7.6 against the built app, from inside the frame
    (the sandbox makes `contentWindow` cross-origin, so only the test runner can
    ask). Carrying a debt like that is fine — writing it down so the last phase
    is forced to discharge it is what made it get paid.
  - **L-DS-9 — `build:unpack` is not a formality; it found the most expensive
    defect of the milestone.** See **D33**. `tasks.md` asked for that check at
    the end of phase 2 and phase 2 did not run it, so a packaged-only 404 of the
    entire Preview survived five phases of green tests. A gate that is only in
    the plan is not a gate.
  - **L-DS-10 — R-8 was never actually closed, and saying so is the point.**
    Screen detection was to be "calibrated against real Specs from the repo".
    There are none: **no UX Spec in this repository uses `## Tela —` headings**,
    so the heuristic is calibrated against constructed cases and the `bmad-ux`
    skill's shipped examples only. Recorded as an open risk rather than a
    checked box; the first real Spec is what will grade it.

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

- **npm-distribution (M6, T1–T16 + T19) implemented on `main` (2026-07-22).**
  Public npm publication (metadata + release pipeline) and the full in-app
  self-update flow, sourced from `registry.npmjs.org`, replacing the
  placeholder `electron-updater` feed end to end:
  - **Main process:** `npmRegistry.ts` (discovery, defensive per ND-R2.4),
    `updateDownload.ts` (stream+hash+verify+extract via `tar`, cancellable),
    `updateApply.ts` (Windows NSIS strategy, `canApply:false` elsewhere),
    `configStore.skippedUpdateVersion`, `updateService.ts` fully rewired onto
    the three (real `fetch`-based `RegistryClient`/`Downloader`, stale-staging
    cleanup, `check(explicit)`/`cancel()`), new `update:cancel`/`reveal`/`skip`
    IPC + preload surface, `electron-updater` dependency removed.
  - **Renderer:** `UpdateNotice.tsx` (Tier 2, DS Toast primitives composed
    directly), ambient dot on the rail gear (Tier 1), `UpdateCenter.tsx`
    (Tier 3, replaces `AppSettingsSheet.tsx`), `useUpdateFlow.ts` (shared
    launch+45min-periodic silent check policy, skip suppression, never
    auto-downloads), full `update.*` pt-BR namespace.
  - **Release tooling:** `scripts/release.mjs` (verify→build→assemble
    platform package→publish platform-then-main, `--dry-run` gate).
  - **Gates:** 908 unit/component tests green, typecheck/lint clean, every
    touched file ≥90% per-file coverage (most files 100%; `preload/index.ts`'s
    pre-existing 89.74%-functions gap, unrelated to this feature, untouched —
    see Lessons). Visual validation via the Playwright MCP + static-build +
    `window.hive` mock recipe found and fixed **two real defects** (see
    Lessons below) — dark+light, 8 scenarios.
  - **Real bug found and fixed outside the task list, directly caused by T2:**
    the scoped package name (`@npm-user-todo/hive-desktop`) broke
    `electron-builder`'s NSIS/dmg/AppImage `artifactName` templates (`${name}`
    resolves to the raw, unsanitized package name, containing `@`/`/`) —
    fixed by switching those templates to `${productName}` (already
    `hive-desktop`), verified with a real `npm run build:win` producing
    `dist/hive-desktop-0.1.0-setup.exe`.
  - **T17 (first publish) and T18 (real-Windows E2E) remain blocked** exactly
    as planned — ND-B1 (npm username unresolved) and real Windows hardware,
    respectively. Everything else was built and verified without them.
  - **`tasks.md` T1–T16+T19 marked `[x]`; ROADMAP M6 updated.**

- **voice-models (M26) IMPLEMENTED on `feat/voice-prompt` (2026-08-23).** Four
  changes that turned out to be one feature: model downloads that survive the
  surface that started them, an app that ships no weights at all, a gate on
  every recording surface, and a builder picker in the Estúdio.

  - **The reported bug had two causes, and neither was "the download failed".**
    (1) Progress was emitted **once per file**, and `medium` is two files and
    2.8 GB — so a 25-minute download reported 0 %, then 42 %, then done. A
    number that does not move is read as a hang, and a hang gets reported as a
    failure. (2) The renderer **owned** the download: `downloadModel` opened an
    IPC subscription and the preload's teardown sent `whisper:download:stop`,
    so closing the sheet killed the transfer. Both were structural, not flaky.
  - **Main now owns downloads** (`whisperDownloads.ts`): records with a lifetime
    of their own, several at once, broadcast to every window, cancellable by id.
    `whisperModelStore` gained **resume** (a `.hive-partial.json` manifest +
    `Range` per file, and a `200` answer to a `Range` request truncates rather
    than corrupting), **retry with backoff** on transport failures only, a
    **disk-space refusal** before spending an hour proving it, byte-level
    progress, and typed failures (`offline`/`server`/`notFound`/`disk`/
    `unsupported`) so the UI can say something actionable. The tree API is now
    asked with `?limit=1000` — the default page is 50, and `whisper-medium`
    ships 31 files under `onnx/` alone.
  - **Nothing ships inside the app any more.** `resources/whisper-models/`,
    `scripts/fetchWhisperModels.mjs` and `npm run models:fetch` are gone (~1.3 GB
    off every installer). `WhisperPreference.id` is now **nullable**, which is
    the change that rippled furthest: "there is no model" is a real state a
    fresh install is in, and every surface that listens had to learn it.
    `pickAutoModel` replaced `isAutoSelectable` — it never rounds *up* (a
    GPU-less laptop must not auto-pick a 2.8 GB `medium` downloaded for another
    machine) and never auto-picks an `.en` build, which would transcribe pt-BR
    into confident nonsense.
  - **The gate** (`voice/useVoiceGate.ts` + `VoiceModelGate.tsx`) is a way in,
    not a wall: it downloads in place and then **starts the take the user
    originally asked for**. The memory ends when the dialog does — a microphone
    that opens by itself ten minutes later, with nothing on screen to explain
    it, is worse than one more click; the completion notice covers that case and
    offers the *model* instead. Wired into the chat composer's mic AND both of
    the ingestion sheet's audio sources (sending a file and pressing record make
    the same promise).
  - **The ending is announced twice, without duplication**: in-app
    (`VoiceDownloadNotices`, app-wide) whenever Hive is on screen, and by the OS
    notification centre when the window is unfocused. The OS strings are the
    only user-facing copy in `src/main` — kept in one named file
    (`osNotificationCopy.ts`) with the exception documented, because the
    renderer's `Notification` web API is denied by `setPermissionRequestHandler`
    and widening that handler for a toast is not a trade worth making.
  - **The Estúdio picks its builder** (`studio.agentLabel`): cards rather than a
    third `Select`, because unlike model and effort this choice *reshapes the
    form under it* — Copilot exposes no effort, so the field disappears. The
    picked agent rides the launch as `StudioLaunchOpts.agentId` and becomes the
    conversation's agent; `startWorkflowTurn` gained an `agentId` override
    because `setConversationAgent` cannot be read back inside the same callback.
  - **Gates:** 3840 unit/component tests green (219 files), typecheck + lint
    clean. Every new file clears the 90/90/90/90 per-file bar; the only
    coverage ERRORs left are the three inherited ones in HARNESS.md, and all
    three *improved*. Visual pass PASS in **three themes** across the library
    (in-use / pinned / downloading / failed / empty), the gate (idle + busy),
    the notices (done + failed) and the builder picker — zero contrast failures,
    zero unmeasured targets.
  - **Four real defects the visual pass caught, that no test would have:** the
    failed row carried a retry button 60 px from the banner's retry (duplicated
    affordance); the gate's grid used `1fr` and clipped its third card off the
    dialog; the gate cards ran name and trade-off together ("smallEquilibrado");
    and the rate/ETA separator double-spaced. Plus two *harness* defects worth
    more than the UI ones — see Lessons.

## M27 — Seletor de motor (modelo + esforço) com detecção real

**2026-08-31.** Três defeitos relatados, uma causa comum: o app *afirmava* o
que cada agente podia rodar em vez de *perguntar* à máquina.

- **Devin sem modelos.** `devinCliAdapter` declarava `models: []` sob a
  premissa "Devin é um agente de modelo fixo". A premissa é falsa: a CLI do
  Devin aceita `--model` (env `DEVIN_MODEL`), guarda um padrão em
  `agent.model` do `~/.config/devin/config.json` e — o que torna isto real —
  **publica a lista**: `devin models list --format json`. O adapter agora
  pergunta; o catálogo curado só existe para a máquina sem a CLI instalada.
- **Modelos do Claude fixos (ex.: Bedrock).** Quatro aliases no código, que
  ficam silenciosamente errados no instante em que a CLI é apontada para
  Bedrock/Vertex/Foundry/gateway. `claudeModelCatalog.ts` lê quatro fontes,
  em ordem crescente de especificidade: catálogo de aliases → cadeia de
  settings (policy > local > projeto > usuário) → env do provedor
  (`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL` com
  `_NAME`/`_DESCRIPTION`, `ANTHROPIC_CUSTOM_MODEL_OPTION`) → **os caches da
  própria CLI** em `~/.claude.json` (`additionalModelOptionsCache`,
  `modelAccessCache`). Medido nesta máquina: a detecção trouxe
  `claude-fable-5[1m]` com a descrição que a CLI escreveu e janela de 1M —
  uma linha que a lista fixa não tinha.
- **Dois dropdowns anônimos.** `Opus` e `Low`, sem dizer o que são nem por
  que escolher um. Viraram **um** controle (`EnginePicker` + o novo
  `OptionPicker` do DS): linhas descritas, agrupadas, com janela de contexto,
  o id em que o alias resolve, filtro por digitação, e a escada de esforço no
  rodapé com uma frase que muda junto com a seleção.

- **Procedência é o produto.** Cada linha carrega `source`
  (`detected`/`configured`/`catalog`) e o rodapé diz qual é a mais forte da
  lista, com o provedor: "Lido da CLI nesta máquina · Amazon Bedrock
  (us-east-1)". Uma lista conferível vale mais que uma lista certa que pede fé.
- **O `''` é a linha "Automático"** — a *ausência* da flag, não uma string
  vazia atravessando o IPC (`Chat` normaliza com `|| undefined`). É também o
  novo padrão: o Hive parou de sobrescrever o modelo que o usuário configurou
  na própria CLI, que era o efeito de `caps.models[0]`.
- **A forma se adapta:** Claude tem 17 linhas em quatro grupos + esforço;
  Copilot agrupa por fabricante (Anthropic/OpenAI/Google) e **não** tem
  esforço (verificado no binário instalado: a flag não existe); Devin lidera
  com o Adaptive marcado como roteador.
- **Não implementado, por medição:** um toggle de *thinking* para o Claude.
  `--settings '{"alwaysThinkingEnabled":true}'` foi testado contra a CLI real
  (2.1.226) em dois turnos com e sem a flag — nenhum bloco de thinking a mais.
  O `--effort` é o controle de raciocínio real da CLI, e é assim que a UI o
  apresenta.
- **Gates:** 3964 testes verdes (+78), typecheck limpo, lint sem erros novos.
  Passe visual PASS nos três temas × duas formas do seletor
  (`tools/visual/engine-contrast.mjs`), zero alvos não medidos.
- **Três defeitos que só o passe visual pegou:** a escada de esforço dividia a
  linha com o título e saía com seis rótulos truncados ("A… B… M…"); a linha
  de procedência cortava exatamente a metade que responde à pergunta que ela
  existe para responder; e `--faint` no id resolvido media 2.78:1 no tema
  claro. Os três estão corrigidos e medidos.
- **Falhas herdadas:** as 15 falhas de ditado/whisper na suíte já existiam em
  `HEAD` (medidas antes de tocar em qualquer coisa) e não foram tocadas.

## M28 — Três defeitos: explorador em loop, transcrição quebrada, ditado ao vivo (2026-08-31)

Um pedido com três itens, e nenhum deles era o que parecia.

### 1. "A aba de arquivos fica piscando e carregando pra sempre" — três causas, todas medidas

Depois de `git init` + reverter tudo. Nenhuma das três é o explorador *sozinho*:

- **`git status` escreve.** Ele atualiza o cache de `stat` do índice e salva.
  Medido em 2026-08-31 num repo de teste: o `mtime` de `.git/index` sobe na
  execução seguinte a um `touch`, e **não sobe** com `--no-optional-locks`. Como
  o watcher reporta essa escrita e o store de git responde re-rodando `status`,
  o app se realimentava. `gitService` agora passa `--no-optional-locks` em todo
  comando (as travas *obrigatórias* de commit/add continuam sendo tomadas).
- **`listTree` andava dentro do `.git`.** A varredura é recursiva e ansiosa, e
  o watcher a re-dispara a cada mudança lá dentro. Medido neste repo: **61 824
  entradas com `.git`, 56 369 sem** — e o `.git` é o diretório mais movimentado
  do disco. `listTree` agora pula `.git`/`.hg`/`.svn` (o VS Code esconde os
  mesmos três); dotfiles do usuário (`.specs`, `.claude`, `.env`) continuam
  visíveis — isto **não** é uma política de arquivos ocultos.
- **Todo refresh apagava a árvore.** `setTreeState({status:'loading'})` rodava
  em toda re-leitura, então cada evento de escrita trocava as linhas por um
  spinner. Agora o spinner é só da **primeira** carga de um workspace; um
  refresh mantém as linhas na tela, e a rajada é coalescida em 250 ms (o mesmo
  debounce que o `useGit` já usava).

O watcher também filtra `.git/**`, **menos** `HEAD` e `refs/**`: um commit ou
checkout feito no terminal é uma mudança real, e é ali que ela aparece. `.lock`
fica de fora — git escreve `refs/heads/x.lock` e renomeia, então deixá-lo passar
reportaria toda atualização duas vezes, a primeira para um arquivo que já não
existe.

### 2. Os dois erros da transcrição eram um só, em cadeia

- **`An ArrayBuffer is detached`** era consequência, não causa. `transferOf`
  transfere o PCM para o worker — o que **destaca** o buffer — e o comentário
  afirmava que a fila guardava uma cópia para os retries. Não guardava:
  `transcriptionQueue` retém o mesmíssimo array que foi transferido. Então a
  primeira falha de um take transformava o botão "Tentar de novo" num segundo
  erro, para sempre. A cópia agora é feita no `whisperClient` (`pcm.slice()`),
  onde vale para todos os chamadores.
- **`std::bad_alloc` no `OrtRun`** é o heap do WASM acabando, e ele **não se
  recupera**: a memória do WebAssembly cresce e nunca volta, então toda execução
  seguinte falha igual. Três frentes: (a) `chunk_length_s` só é pedido para
  áudio maior que a janela de 30 s — numa frase ditada aquilo era alocação
  excedente pura; (b) trocar de modelo agora dá `dispose()` no pipeline que sai,
  em vez de deixar ~1 GB de pesos fp32 no heap de onde o próximo tem que
  alocar; (c) a falha é classificada (`kind: 'memory'`) e o cliente **troca o
  worker** — é a única coisa que devolve o heap. E a mensagem vira conselho
  acionável ("escolha um modelo menor"), porque repetir não muda nada.

### 3. Ditado ao vivo (VP-R2.9) — o pedido explícito

*"não deveria o usuário ter que terminar tudo para só depois transcrever"*. Nada
estava quebrado: o pipeline era construído em torno de um **limite**. Um segmento
só é entregue quando o silêncio o fecha ou quando ele bate no teto de 9 s, então
quem fala emendado via as primeiras palavras nove segundos depois de dizê-las.

Agora a frase **aberta** também é transcrita, repetidamente, enquanto cresce
(`livePass.ts` + `Segmenter.draft()`), e o resultado vira um trecho provisório no
campo (`previewRun.ts`), sublinhado tracejado, substituído pelo próximo palpite e
por fim pelo texto real do segmento. O ritmo é o projeto inteiro: um por vez, só
com a fila ociosa (um palpite que atrasa o segmento que ele adivinha piorou as
coisas), só com fala nova o bastante para valer uma vaga do pipeline, e desiste
depois de 2 falhas seguidas.

**Defeito que só o passe visual pegou, e que nenhum teste tinha:** o texto
aparecia **duas vezes**. Duas escritas no mesmo tick — o palpite saindo, o texto
real entrando um microtask depois — e a segunda perguntava ao campo onde estava o
cursor. O campo respondia pelo DOM, que o React ainda não tinha atualizado. Então
o texto real entrava *depois* do palpite em vez de por cima. `useComposerDictation`
agora espelha o valor e o cursor pendente de forma síncrona na escrita.
`useComposerDictation.test.ts` reproduz exatamente isso (verificado que morde:
sem o espelho, o teste falha com a frase duplicada).

### Gates

- **4045 testes verdes**, typecheck limpo, lint **sem erros** (os 12 que havia
  eram herdados: `tools/spikes/**.mjs` eram JS puro sendo cobrado por uma regra
  de TS — agora isentos como `scripts/**` já era — e um `setState` direto em
  efeito no `useWhisper`).
- **15 testes de ditado/whisper que já estavam vermelhos em `HEAD`** foram
  corrigidos: eram todos defasagem (o `partial` novo no `QueueState`, o `warm`
  que virou método próprio, o `onPartial` na ingestão) mais um de causa real —
  `IngestPanel` dublava `@huggingface/transformers`, o que parou de funcionar
  quando o motor foi para um worker que o jsdom não tem. O dublê agora é do
  **thread** (`testSupport/whisperWorkerMock.ts`).
- **Cobertura:** `livePass.ts` e `previewRun.ts` entram no gate a 100%.
  `useWhisperDictation` subiu de 85,71 → 87,5 em branches. A lista herdada
  **não cresceu**.
- **Passe visual/funcional** (`tools/visual/live-dictation-pass.mjs`,
  `tools/visual/explorer-refresh-pass.mjs`) nos temas escuro e claro: texto no
  campo a ~1,3 s de fala (antes: nada até o corte), sublinhado tracejado real
  (`text-decoration-color` explícito — o backdrop é `color: transparent`, sem
  ele não se desenha nada), substituição sem duplicar; e a árvore com 12 linhas
  na tela durante uma varredura que nunca retorna, com 20 eventos virando 1
  varredura.

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

## M29 — Parakeet substitui o Whisper: transcrição nativa (2026-09-02)

O pedido foi "substituir o Whisper pelo [Handy](https://github.com/cjpais/Handy)
no ditado em tempo real, porque está lento, pesado e impreciso".

**O Handy não é embutível.** É um app Tauri standalone sem API, servidor ou
biblioteca; seus flags de CLI acionam a gravação por atalho global *dele*, e ele
entrega texto **colando no campo com foco do SO**. Não há como escrever no
estado do composer nem alimentar o texto provisório do `livePass`. O que se
adota é o **motor** que o torna rápido: NVIDIA **Parakeet TDT 0.6b v3**. O Handy
chega nele via `transcribe-rs`; nós chegamos nos mesmos pesos ONNX via
`sherpa-onnx-node` (Apache-2.0, binários Node-API pré-compilados por
plataforma).

Decisão do usuário: inferência **nativa** (não WebGPU no renderer) e **remover o
Whisper por completo**, inclusive para áudio gravado.

### As três queixas tinham uma causa estrutural cada

Nenhuma estava ao alcance de um ajuste, e todas são propriedades do lugar onde a
inferência rodava, não do Whisper:

- **Lento.** `whisperEnv.ts` fixava `numThreads = 1` porque um renderer
  `file://` não é cross-origin isolated e portanto não tem `SharedArrayBuffer`.
  Somado a isso, o Whisper vê **30 s de mel frames por forward pass**: uma frase
  ditada de 2 s custava quase o mesmo que 30 s.
- **Pesado.** Os pesos rodavam em **fp32** (o decoder q8 não cria sessão no
  onnxruntime-web) dentro do heap WASM do renderer — "um heap que só cresce",
  como dizia o comentário de `whisperEngineCore.ts`. O M28 gastou uma frente
  inteira nisso (`std::bad_alloc` no `OrtRun`, troca de worker para devolver o
  heap), e o M26 mediu o teto de 2 GiB por `ArrayBuffer`.
- **Impreciso.** Só melhorava de verdade no `medium` (2,9 GB fp32), que não cabe
  na máquina da maioria.

ONNX Runtime nativo não tem nenhuma das três propriedades.

### Medições, não estimativas

Spike em 2026-09-01, 8 núcleos, `numThreads = 4`:

- **12,6× tempo real** em pt-BR; a sessão custa **1,8 s** e **~1 GB residentes**
  — os dois números que explicam o descarte por ociosidade em `asrEngineCore`.
- **WER de 9,55%** em pt-BR (FLEURS, 8 clipes, 157 palavras), com **4 dos 8
  clipes em WER zero**. Referência: o `small` que o app rodava fica na casa de
  15–20% no mesmo benchmark.
- **Ponto fraco medido:** os dois clipes ruins (30% e 33%) falham em **nomes
  próprios estrangeiros e jargão** — "Lakkha Singh", "Robin Uthappa", "innings",
  "bhajans" — não em português. É conteúdo da FLEURS traduzido da Wikipédia
  inglesa. **Isso é relevante para este produto**: quem dita prompt de código
  mistura termos técnicos em inglês, e essa é a hipótese que só uso real
  confirma ou derruba.

O download encolhe junto: **671 MB int8** (encoder 652 + decoder 11,8 + joiner
6,4 + tokens), contra 923 MB do `small` fp32 e 2,9 GB do `medium`. 600 M de
parâmetros — mais que o `medium` que ninguém conseguia rodar, menor que o
`small` que todo mundo rodava.

### O que foi deletado, e por quê isso é o trabalho

- **O catálogo inteiro.** Dez modelos, a escada de recomendação
  (`whisperHardware`), o calculador de aderência (`modelFit`), os medidores de
  precisão/velocidade (`ModelMeter`), a `ModelLibrary` de 408 linhas e o
  escolhedor de três cards do portão. Tudo existia para ajudar alguém a resolver
  um trade que o app não resolvia. Parakeet é os dois lados; a melhor versão de
  uma escolha que ninguém deveria fazer é a ausência dela.
- **O esquema privilegiado `hive-model:`**, com a entrada `connect-src` do CSP.
  Ele existia só porque um renderer sandboxed rodava o modelo e não podia buscar
  os próprios pesos. O renderer não vê mais um arquivo de peso, e o esquema mais
  seguro é o que não existe.
- **O `pcm.slice()` do M28.** Ele guardava contra o buffer destacado pelo
  `transfer` para o worker — a `transcriptionQueue` retém o mesmo array, então a
  primeira falha de um take transformava "Tentar de novo" num segundo erro, para
  sempre. IPC **clona**: o modo de falha sumiu, não foi contornado.
- **O conselho "escolha um modelo menor"**, com a falha que o produzia.
- `@huggingface/transformers`, o plugin `copyOrtAssets` e `tools/spikes/whisper*`.

`whisperClient.ts` tinha 418 linhas; `asrClient.ts` tem ~100. A diferença é
tudo o que o renderer fazia por ser o motor: sondar WebGPU, escolher precisão a
partir disso, conferir bytes em disco, iniciar download, criar um `Worker`, e
trocar o worker inteiro para recuperar memória.

### Armadilhas medidas

- **`sherpa-onnx-node` resolve seu `.node` por caminhos relativos e por
  `process.env.PWD`.** Dentro do asar as duas estratégias falham e o pacote
  resolve para `undefined` **em vez de lançar** — o primeiro sintoma seria
  `Cannot read properties of undefined (reading 'OfflineRecognizer')` no momento
  em que alguém tenta falar. Precisa das duas metades: `asarUnpack` de
  `node_modules/sherpa-onnx*` **e** o `require` redirecionado
  (`asrAddon.ts`).
- **Os dois lados do canal do utilityProcess não são simétricos.** No main,
  `child.on('message', …)` entrega a mensagem; no filho,
  `process.parentPort.on('message', …)` entrega um `MessageEvent` cujo `.data`
  é a mensagem. Escrevi a interface errada primeiro; `AsrChild` agora tem
  `onMessage`/`onExit` nomeados justamente para que a assimetria esteja no tipo.
- **O cliente não pode capturar a ponte na construção.** É um singleton de
  módulo que sobrevive a qualquer `window.hive`; capturar acoplava-o ao que
  existia no primeiro uso, e isso quebrou de verdade sob `vi.restoreAllMocks()`
  — a ponte velha resolvia, retornava `undefined`, e o sintoma era
  `Cannot read properties of undefined (reading 'catch')` de dentro do pre-warm.
  Ler por chamada não custa nada e não tem ordem para errar.
- **`remove()` assíncrono com `try/catch` síncrono.** Escrevi um catch que nunca
  podia pegar a falha do delete; a cobertura expôs o ramo inalcançável. O hook
  agora devolve a `Promise`, que é o que permite a tela dizer que falhou —
  Windows recusa apagar um peso que o motor ainda tem aberto.
- **`sherpa.readWave` é proibido no Electron.** Medido no runtime real
  (Electron 39.8.10, ABI 140): lança `Error: External buffers are not allowed`,
  porque o Electron veta o `ArrayBuffer` externo que o addon devolve. **O
  caminho de produção não é afetado e foi verificado ponta a ponta no mesmo
  runtime** — `Float32Array` comum entrando em `acceptWaveform`, texto saindo de
  `getResult`, decode em 497 ms, RSS 1042 MB — porque o renderer decodifica com
  WebAudio e o PCM cruza o IPC. A armadilha fica para quem depois quiser
  "transcrever este arquivo direto do main": tem de decodificar em JS também.
- **`onPartial` continua na assinatura e nunca é chamado.** Existia porque uma
  passada do Whisper levava segundos; sherpa decodifica numa chamada bloqueante
  e não tem o que transmitir. O que o substitui é a chamada ser rápida o
  bastante para não precisar dele — e o `livePass` do M28, que reoferece a frase
  aberta, continua sendo o mecanismo que faz o ditado parecer ao vivo.

### Gates

- **`verify` verde: 228 arquivos, 3976 testes**, typecheck limpo, lint **sem
  erros** (36 avisos, contra 39 antes — todos herdados).
- Addon nativo verificado no runtime do **Electron** (`node 22.22.1`,
  `electron 39.8.10`, **ABI 140**), não só no Node do sistema. O build emite
  `out/main/asrWorker.js` como segundo entry.
- **Lacunas de cobertura pré-existentes, medidas, não introduzidas por este
  milestone:** `Explorer.tsx` estava em 89,96% de ramos antes e depois (medido
  no commit `47555b9`); fechada com um teste do anúncio de atalho no macOS
  (`aria-keyshortcuts` = `Meta+X`, não `Ctrl+X`), que era comportamento real e
  não asserido.

### Os modelos antigos, e por que não são apagados

Uma instalação que atualiza fica com o store Whisper anterior em `userData` —
frequentemente vários GB que ninguém mais lê. **Não há migração que apague.**
O que está lá é um download que o usuário esperou vinte minutos, e removê-lo
sozinho no primeiro boot depois de uma atualização não é migração, é surpresa
sem desfazer. O painel de voz mede, diz o número e põe um botão ao lado.

A medição ignora symlinks de propósito: liberar o store não devolveria o
espaço do alvo, e prometer bytes que o usuário pode conferir e achar errados é
pior do que não prometer.

### Um defeito de contraste que só o passe visual pegou

O selo "Baixado" usava `--success-ink`, que é medido contra a superfície comum.
O painel do modelo tem fundo tingido (`--selected-bg`), e ali o par dá
**4,47:1 — abaixo de AA**, no tema claro. O design system já tem o token para
isso (`--success-tint-ink`, mais escuro justamente em tema claro); a correção
foi usar o token certo, não escurecer um valor à mão.

### O que falta

- **Fase 6 — reafinar o ritmo do ditado.** `minSpeechMs`, `growthMs` e o teto de
  9 s por segmento foram calibrados em volta da janela de 30 s do Whisper, onde
  uma passada era cara. A 12,6× tempo real eles estão folgados. Passo de
  medição com o motor real na mão, não de chute.
- **Validação em uso real** com a voz do usuário, especialmente a hipótese dos
  termos técnicos em inglês acima.

---

## M29.1 — O instalador não levava o motor (2026-09-02)

O usuário gerou um `.exe`, baixou o modelo e ditou. Não transcreveu nada, em
silêncio; na segunda tentativa apareceu, em inglês, `Could not find
sherpa-onnx-node. Tried ../build/Release/sherpa-onnx.node …`.

Eram **três defeitos independentes** que se somaram, e nenhum deles era o motor.

### 1. O binário nativo nunca esteve no instalador

`sherpa-onnx-node` distribui o binário em seis pacotes por plataforma, cada um
declarando `"os": ["win32"], "cpu": ["x64"]` e afins. O npm instala **só o do
host**. O instalador foi gerado no WSL (Linux), então `node_modules` tinha
apenas `sherpa-onnx-linux-x64` — e o `electron-builder --win` empacotou
alegremente um app Windows cujo único binário nativo era um `.so` de Linux.

Nada na build tinha opinião sobre isso. **Era essa a causa de ter ido para o ar.**

- `scripts/lib/asrBinary.mjs` — `beforePack` busca o pacote da plataforma-alvo
  (via `npm pack`, que não tem o portão de `os`/`cpu`; medido: `npm install
  --os=win32` ainda recusa uma dependência direta com `EBADPLATFORM`), e
  `afterPack` **lê a árvore empacotada** e falha a build se o binário não
  estiver lá ou se sobrar o de outra plataforma.
- Provado que o guarda dispara: removendo o `.node` da saída, `afterPack` acusa.
- `win:`/`mac:`/`linux:` ganharam exclusões — sem elas o instalador Windows
  levava ~32 MB de `.so` que nunca poderia carregar.

### 2. A falha desaparecia quando a gravação terminava sozinha

O sintoma "não aconteceu nada" não era o mesmo bug. `finish()` é alcançado por
dois caminhos de idades diferentes: apertando **Concluir** é o closure do render
atual; pelo **autostop** é o congelado dentro de `capture.onTick` quando o
microfone abriu — e ali `sink.failure` é sempre `null`, porque nada foi
transcrito ainda. A tomada terminava em `idle`: sem texto, sem erro, sem retry.

`silenceHoldMs` (700 ms) fecha o segmento muito antes de `autoStopMs` (8 s), então
na vida real a fila já falhou e drenou quando o autostop chega. Um teste que
emite todo o silêncio num `act()` síncrono **não** reproduz — a rejeição ainda é
uma microtask pendente e `finish` pega o ramo do dreno. Foi preciso separar em
dois `await act`.

Correção: `sink.failureNow()`, lido da fila, como `count()` já fazia. O próprio
arquivo já documentava esse risco para `enginePhaseRef` — faltava um campo.

### 3. A mensagem estava na língua errada, sobre a coisa errada

`engineErrorCopy` não casava com "Could not find" (o padrão era `not found`), e
o prefixo `Error invoking remote method '…': AsrError:` é encanamento do
Electron. O usuário leu o mecanismo. Agora há um terceiro caso — instalação sem
o motor — cuja próxima ação é reinstalar, não tentar de novo.

### E um quarto, achado ao medir: **app.asar de 2,7 GB**

A lista `files` era um blocklist de sete itens; tudo o mais ia junto — `src/`,
`coverage/`, `.specs/`, `e2e/`, `.claude/` e, recursivamente, `dist/`, de modo
que cada build embutia o instalador do build anterior. Virou allow-list
(`out/`, `resources/`, `package.json` — o único que o runtime lê, via
`__dirname`): **2,7 GB → 75 MB**.

Armadilha medida junto: **`files` de plataforma substitui a lista comum, não a
estende.** Um bloco `linux:` com uma única exclusão reintroduziu `**/*` e
empacotou tudo de novo. Por isso as três plataformas repetem as três entradas.

### Download automático do modelo na inicialização

Pedido do usuário. `asrAutoDownload.ts` guarda a regra, e a condição que o
pedido não menciona é a que importa: **"Remover" existe para devolver 671 MB**, e
uma inicialização que rebaixa tudo na próxima abertura torna o botão uma
mentira. Uma remoção grava `asrAutoDownload: false` no config; pedir o modelo de
novo re-arma.

### Validado no app empacotado de verdade

Não em dev: `dist/linux-unpacked/hive` dirigido por Playwright, chamando
`window.hive.asr.transcribe` — preload → IPC → `utilityProcess` →
`app.asar.unpacked` → addon nativo → modelo real.

- `"Ask not what your country can do for you…"` e
  `"No preguntes qué puede hacer tu país por ti…"` (com acentos) — corretos.
- Decode: **13,6× e 14,1× tempo real** (284 ms para 3,85 s; 378 ms para 5,33 s).
- Sessão: **1,56 s com cache quente** — mas **7,8 s na primeira vez**, lendo os
  671 MB do disco frio. Esse número não estava medido antes.
- Perfil novo: janela em **674 ms** e o download começando sozinho; após
  "Remover", a reabertura **não** rebaixa.
- Guarda do fragmento (`MIN_DECODE_SAMPLES`) responde em 1 ms com `''`.

---

## agent-tool-details — o que a ferramenta rodou e o que voltou (2026-09-02)

Pedido do usuário: poder **expandir qualquer ação do agente e ver os detalhes**
(o comando rodado, a saída), como Claude Code / Cursor / Copilot fazem.

O feed de atividade já dizia *que* algo aconteceu — `Rodou npm run verify · 12s`
— e nada mais: o comando era cortado na primeira linha e em 96 caracteres, e o
**resultado nunca aparecia em lugar nenhum**. Um comando que passou e um que
falhou desenhavam a mesma linha. A única ferramenta com algo por trás era a de
edição, porque `toolPatch.ts` reconstrói o diff.

- **A captura é do main, e o teto também.** `toolDetails.ts` transforma o
  `tool_use.input` numa lista ordenada de argumentos e o `tool_result.content`
  numa saída, com corte em 2 000 caracteres por argumento e 8 000 por resultado
  — **reportado** (`truncated`), nunca escondido. O corte fica na origem porque
  esses objetos atravessam o IPC e depois ficam em memória enquanto a conversa
  estiver aberta; um `Read` de arquivo grande devolve centenas de kB e um turno
  faz dezenas de chamadas.
- **A linha vira a divulgação do próprio registro.** Vale para toda ferramenta,
  não só para as que mexem em arquivo. Passo sem nada por trás continua sendo
  uma linha de status sem chevron.
- **Padrão de abertura difere por tipo.** Um patch abre sozinho (uma mudança que
  ninguém expandiu é uma mudança que ninguém revisou); todo o resto abre fechado
  — quarenta comandos abertos soterrariam a resposta que os explica, que é
  justamente o "log-dump" que o `PRODUCT.md` lista como anti-referência. O
  estado guardado é o **desvio do padrão**, não o aberto/fechado absoluto.
- **Os nomes dos argumentos são traduzidos, o valor não.** `file_path` vira
  "Arquivo" (`toolParamLabel`), com o nome original no `title` — nossos usuários
  são PMs e analistas, não gente que leu o schema. Chave desconhecida (toda a
  vocabulária de MCP) passa inteira. Booleano vira Sim/Não; qualquer outro valor
  viaja literal, porque um valor reescrito deixa de bater com o que foi enviado.
- **`OutputBlock` no design system.** Bloco de saída de máquina com teto que
  cresce no lugar, cópia, nota de corte, tom de falha e esqueleto de espera —
  três superfícies do app precisavam disso e nenhuma tinha. Não é o `CodeBlock`
  (esse é para código autoral em prosa: sem teto, sem estado vazio, sem falha).
- **Sem cartões aninhados.** A primeira versão embrulhava os blocos num painel
  com borda; a moldura aparecia duas vezes e significava uma. O painel ficou sem
  moldura, e o cabeçalho "Chamada" caiu junto — ele ficava 8px acima do rótulo
  "Comando" do próprio bloco, duas patentes de título dizendo a mesma coisa.

Passe visual fechado nos três temas (`tools/visual/tool-details*.mjs`): 16 alvos
de contraste × 3 temas + 6 checagens de teclado/ARIA, todos verdes. Três defeitos
reais saíram dele e estão em `docs/visual-validation.md` — a sonda cega a
`oklch()`, o `var(--ink-2)` que não existe neste sistema (e que achatava o painel
inteiro num cinza só) e o `aria-controls` pendurado numa linha fechada.

---

## Preferences

- Lightweight tasks (state updates, session handoff, small doc edits) work
  well with faster/cheaper models — noted per the skill's own guidance.
