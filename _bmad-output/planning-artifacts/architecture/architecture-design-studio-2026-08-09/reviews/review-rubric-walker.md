# Rubric Walk — Design Studio Architecture Spine

Reviewer: rubric-walker subagent. Target: `ARCHITECTURE-SPINE.md` (2026-08-09), judged
against its driving PRD (`prd.md`) and `addendum.md`, and spot-checked against the real
Hive Desktop codebase at `hive-desktop/src/`. Each item below is graded independently;
citations are `file:line` against the actual repo unless noted.

---

## 1. Does it fix the real divergence points for epics/stories — and miss none?

**Verdict: Mostly yes, with a handful of real gaps.**

What it does fix, cleanly: the tab-vs-sidebar-vs-dialog question (AD-1), the
manual-edit-vs-chat-edit dual-write-path risk (AD-2/AD-3), the DS-package-leak-into-five-places
risk (AD-4), the `srcDoc`-vs-protocol preview question (AD-5), the
two-HTML-generators risk (AD-6), where session state lives (AD-7), what one undo unit is
(AD-8), per-adapter branching (AD-9), and the two-different-error-shapes risk (AD-10). These
are the obvious, high-value divergence points and the spine nails them.

Gaps found — places where two independently-built stories could still diverge:

- **`Command` union has a trailing "…"** (spine line 121: `AddComponent`, `RemoveComponent`,
  `MoveComponent`, `SetProp`, `…`). AD-2/AD-3 fix *that* mutation only happens via Commands,
  but leave the vocabulary itself open-ended. Two builders implementing FR-7 (structural
  editing) could independently invent different command shapes for the same operation (e.g.
  one team adds `DuplicateComponent`, another expresses duplication as `AddComponent` +
  manual prop copy) — the closed-vocabulary guarantee AD-2 promises is only as closed as this
  list, and the list isn't closed.
- **Does the FR-2 initial generation participate in the undo stack?** AD-8 says "a manual
  edit pushes one step; all Commands emitted by one chat turn push as a single grouped step" —
  but is silent on whether the initial Skill-generated skeleton (FR-2, which is also emitted as
  `Command[]` per AD-3) is (a) the zero-th/baseline state a user can never undo past, or (b) just
  another grouped step they can undo back to a blank Tela. UJ-1/UJ-2 in the PRD don't resolve
  this either. Real divergence risk for whoever implements the undo stack's initial seed.
- **How does the selected Componente (FR-5) reach the Skill's prompt for a scoped chat
  request (FR-10)?** The Consistency Conventions table (spine line 123) places "current
  selection" firmly in transient UI state, outside `ScreenDocument`. FR-10's testable
  consequence is "quando há um Componente selecionado no momento do envio, o pedido é
  interpretado no contexto daquele Componente por padrão" — but no AD or Structural Seed
  entry says `IterationChat.tsx` must pass the selection into `skillDesignSystem.ts`'s prompt
  construction. Two builders could reasonably diverge on whether this is even wired.
  Governed only by AD-9 in the Capability Map (spine line 192), which is about agent routing,
  not about what context reaches the prompt.
- **How is "already edited vs still auto-generated" (FR-4's second testable consequence)
  computed for the Tela selector?** The Capability Map cites AD-1/AD-7, neither of which
  defines this. It's derivable (command-stack length > 0?) but that derivation isn't stated
  anywhere, so two builders could compute "edited" differently (e.g. one counts the initial
  FR-2 generation as "edited", contradicting whatever answer the previous bullet's ambiguity
  resolves to).
- **Where do the DS package's static assets (JS/CSS/icons/fonts) physically live for
  `previewProtocol.ts` to serve in a *packaged* build, not just `npm run dev`?** See §7 below
  for the evidence — this is a genuine, concrete build-time divergence risk the spine doesn't
  address at all.
- **Per-Tela export failure isolation (FR-15)** is asserted in the Capability Map ("falhas
  isoladas") but not backed by any AD's Rule — see §3 and §6.

## 2. Is every AD's Rule enforceable, and does it prevent its stated divergence?

**Verdict: Mostly yes. AD-5, AD-6, AD-7, AD-8, AD-10 are concretely enforceable. AD-2/AD-3/AD-4
are enforceable only by code-review discipline, with no automated sensor proposed despite a
directly-applicable precedent already in the codebase. AD-9's rule is narrower than its intent.**

- **AD-5** (privileged protocol, sandbox flags, no `allow-same-origin`, CSP directives) is the
  strongest AD in the document: every literal claim is checkable against real code and, per §5
  below, is real. A builder violating it (e.g. adding `allow-same-origin`, or using `srcDoc`)
  produces a diff any reviewer can catch line-by-line. Prevents what it says it prevents.
- **AD-7** (one JSON file per session, `write-temp-then-rename`, spec is read-only) is equally
  concrete and directly checkable against `sessionStore.ts`'s eventual implementation.
- **AD-8** (one stack per Tela, one undo unit per chat turn) is unit-testable almost verbatim
  (dispatch N commands from one chat turn, assert one `undo()` reverts all N). Good AD, modulo
  the FR-2-baseline ambiguity noted in §1.
- **AD-10** (`CapabilityViolation` shared shape) is checkable via a shared type import used by
  both `Inspector.tsx` and `IterationChat.tsx`.
- **AD-2/AD-3/AD-4** ("no direct tree mutation," "Skill never emits markup," "no other module
  imports a DS package") are enforceable by a human doing code review, but the spine proposes
  no automated check — and the codebase already has the exact pattern needed: 
  `hive-desktop/src/main/moduleBoundaries.test.ts` is a pure AST-scanning test that walks every
  `.ts`/`.tsx` file and flags disallowed imports across a boundary (there: main/preload/renderer
  process zones). The identical technique — scan for `import ... from '@awesome.me/webawesome'`
  outside `dsAdapter/webAwesomeAdapter.ts`, or scan for direct `screenDocument` state mutation
  outside the reducer — is a one-file addition, and the spine cites `moduleBoundaries.test.ts`'s
  sibling precedent nowhere. This isn't a spine that must specify tests, but for a
  "prevents divergence" claim resting entirely on convention-following, naming a concrete,
  already-precedented enforcement mechanism would have made the Rule meaningfully stronger.
- **AD-9**'s literal rule — "No `if (agentId === 'claude')` branches inside Design Studio" —
  is grep-checkable, but narrower than its own "Prevents" clause ("Design Studio code assuming
  Claude-specific capabilities"). A builder could satisfy the literal rule while still special-
  casing on `capabilities().models` contents, or writing `if (agentId !== 'claude')`, or
  branching on `AgentCapabilities.supportsAttachments` in a Claude-specific way that happens to
  also fail for Devin. The rule polices one textual pattern, not the general property it's
  named for.

## 3. Does anything under "Deferred" risk letting two units diverge?

**Verdict: The seven listed items are all legitimately safe to defer — none of them is a
disguised divergence point that should have been an AD.** Spot check:

- Export Bundle format — genuinely blocked on an external, unconfirmed contract (Figma Agent);
  the seam (`renderToStaticHtml`, AD-6) is real and format-agnostic, so deferring the *shape*
  doesn't let two Preview/Export implementations diverge from each other.
- Preview isolation depth beyond sandbox flags — AD-5 already fixes the mechanism; deferring
  *whether it's sufficient* is a security-review action item, not an implementation-divergence
  risk.
- DS migration, multi-user collab, long-term version history, cost budget — all explicitly
  out-of-MVP in the PRD itself (§6.2, §5, §8); the spine correctly declines to invent
  architecture for out-of-scope features.
- AD-1/PRD-§9 reconciliation — already flagged as an action item in both AD-1's Rule and the
  Deferred list; not a case of silent punting.

**However**, two topics that *do* carry real divergence risk are addressed by neither an AD
nor a Deferred entry — they're simply absent (cross-referenced from §1/§6/§7, not double-counted
here): per-Tela export failure isolation for FR-15, and non-catalog error handling (agent
process failure, protocol/asset load failure, orphaned session when the Spec de UX file moves
or is deleted). These should have appeared *somewhere* in the document — as an AD if decided,
or as a Deferred bullet if consciously punted — and appear in neither.

## 4. Is all named tech verified-current, not asserted from training-data memory?

**Verdict: Largely verified and accurate; one claim in the Stack section is imprecise.**

Checked directly against the npm registry and GitHub (fetched live, not from memory):

- `curl https://registry.npmjs.org/@awesome.me/webawesome` → `dist-tags.latest: "3.11.0"`,
  matching the spine's `^3.11` claim exactly. The `3.11.0` version entry's `time` field is
  `2026-07-30T16:12:41.739Z` — 10 days before the spine's "Verified 2026-08-09" date, which is
  consistent with an actual live check rather than a stale training-data guess (this version
  postdates any plausible training cutoff).
- Same registry payload: `"license": "MIT"` on the `3.11.0` entry — matches. `dependencies`
  includes `"lit": "^3.2.1"` — confirms "built on Lit."
- `github.com/shoelace-style/webawesome` releases via the GitHub API confirm the rename
  happened and the package is live at that path — matches the spine's "Shoelace is
  archived/renamed as of 2026... successor is `@awesome.me/webawesome`" claim.
- **Imprecise claim**: the spine says the Pro tier "only gates extra icon/theme packs, not the
  core component catalog v1 needs." Per Web Awesome's own docs and a maintainer comment on
  `shoelace-style/webawesome#1353`, Pro also gates a subset of *components* (e.g. Combobox is
  explicitly marked Pro-only in the docs) and "Patterns" (copy-paste HTML compositions,
  distinct from components) — not just icon/theme packs. I spot-checked the specific
  components the addendum names as needed (dialog, dropdown, tooltip, card, tabs, badge) and
  all six are free/core, so the spine's *bottom-line conclusion* ("what v1 needs is free")
  held up under spot-check — but the stated *mechanism* ("only... icon/theme packs") is
  incomplete/inaccurate and could mislead a builder who later reaches for Combobox or a Pro
  pattern expecting it to be free.

## 5. Does it ratify or contradict the real Hive Desktop codebase?

**Verdict: Strong — every concrete, checkable claim I spot-checked was accurate. One
unacknowledged structural deviation found.**

Confirmed accurate:

- `EditorTabKind` union is exactly `'file' | 'diff' | 'conflict' | 'commit' | 'review'` —
  `hive-desktop/src/renderer/src/ui/useEditorTabs.ts:6`. The spine's "following the precedent
  already set by `diff`/`commit`/`conflict`/`review` kinds" is accurate.
- The tab system's pane id is literally `'viewer'` —
  `hive-desktop/src/renderer/src/WorkUI.tsx:206` (`type PaneId = 'rail' | 'chat' | 'viewer'`),
  used at `WorkUI.tsx:913,921,922`. The spine's "opened in the existing `viewer` pane's tab
  system" is accurate, not approximate.
- `SidebarView` is exactly `'explorer' | 'scm' | 'review' | 'brain'` —
  `hive-desktop/src/renderer/src/ui/ActionRail.tsx:26`. AD-1's characterization of why this
  union is the wrong fit is accurate.
- `whisperProtocol.ts`'s privilege object matches the spine's claim verbatim:
  `standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
  bypassCSP: false` — `hive-desktop/src/main/whisperProtocol.ts:33-43`. It is also, per
  `hive-desktop/src/main/index.ts:152-153,964`, the *only* custom protocol currently
  registered, so AD-5 citing it as "the" precedent (not "a" precedent among several) is
  correct.
- `chatHistoryStore.ts`'s own header comment states the "disk is the single source of truth...
  write-to-temp-then-rename" pattern almost word for word (`chatHistoryStore.ts:26-31`), and the
  implementation matches: `chatHistoryStore.ts:231-234` writes to
  `` `${finalPath}.tmp-${process.pid}-${Date.now()}` `` then `renameSync`s it into place. AD-7's
  citation is accurate both in spirit and in the actual code.
- `AgentAdapter` interface exists exactly as described —
  `hive-desktop/src/main/agentAdapter.ts:382-387` (`id`, `displayName`, `capabilities()`,
  `startSession()`). Devin and GitHub Copilot CLI adapters are real, existing files
  (`hive-desktop/src/main/devinCliAdapter.ts`, `hive-desktop/src/main/copilotCliAdapter.ts`,
  each with a `.test.ts`), confirming AD-9's "both already implemented behind the same
  contract" is true today, not aspirational.
- `HtmlPreview.tsx`'s sandbox/`srcDoc`/no-`allow-same-origin`/no-base-URL limitations, cited in
  AD-5 and the addendum, match the component and its own doc comment exactly
  (`hive-desktop/src/renderer/src/explorer/HtmlPreview.tsx:6-22,37-38`).
- The renderer's CSP `<meta>` tag is real and single, at
  `hive-desktop/src/renderer/index.html:18-20`, with no pre-existing `frame-src` directive —
  meaning AD-5's instruction to add one for `hive-studio://` is not decorative; without it, the
  existing `default-src 'self'` would silently block the new iframe's `src`.
- The flat `<namespace>:<action>` preload IPC convention is real:
  `hive-desktop/src/preload/index.ts` groups methods under `agent`, `workflows`, `skills`,
  `studio`, `mcp`, `git`, `review`, `secondBrain`, `whisper`, etc. — `designStudio:*` /
  `window.hive.designStudio.*` fits this convention exactly.

**Deviation found**: the Structural Seed proposes `main/designStudio/` (with a nested
`dsAdapter/` sub-folder) as a new subdirectory under `src/main/`. I listed every existing
subdirectory under `src/main/`: only `__fixtures__` exists — every one of the ~60 real
service/adapter files (`agentService.ts`, `gitService.ts`, `mcpService.ts`, `reviewService.ts`,
`secondBrainService.ts`, `chatHistoryStore.ts`, etc.) lives flat at `src/main/*.ts`, with zero
precedent for a per-feature subdirectory on the main-process side. By contrast,
`src/renderer/src/` *is* organized into per-feature subdirectories (`chat/`, `explorer/`,
`scm/`, `secondBrain/`, `mcpLogs/`, `dictation/`, `onboarding/`, `tour/`, `ui/`), so
`renderer/src/designStudio/` fits that half of the convention perfectly. The spine introduces a
new organizational pattern for `main/` without acknowledging it's a deviation — contrast this
with AD-1, which explicitly calls out and flags its PRD deviation for confirmation. This isn't
necessarily the wrong call (seven new main-process files is a reasonable case for grouping,
and nothing in `moduleBoundaries.test.ts` — which only polices cross-*process* imports, not
intra-process directory layout — would block it), but it's an unflagged departure from the
actual codebase pattern in a document whose whole job is to ratify that pattern.

## 6. Does it cover PRD's FR-1 through FR-15?

**Verdict: Yes, all 15 present in the Capability → Architecture Map — but two rows only
partially cover their FR's stated testable consequences.**

Row-by-row presence check: FR-1 through FR-15 all appear (spine lines 183-197), each with a
"Lives in" and "Governed by" column. Full coverage on presence.

Depth check against each FR's *testable consequences* in the PRD surfaced two partial misses
(both already detailed in §1, referenced here for the FR-coverage angle specifically):

- **FR-4**'s second consequence ("O seletor indica quais Telas já foram editadas nesta sessão
  vs. ainda no estado gerado automaticamente") — the map cites AD-1, AD-7, neither of which
  defines what "edited" means or how it's computed.
- **FR-10**'s first consequence ("quando há um Componente selecionado... o pedido é
  interpretado no contexto daquele Componente por padrão") — the map cites AD-9, which is
  about agent-adapter routing, not about threading selection state into the prompt.

Every other FR's map row's cited AD(s) genuinely back the FR's stated consequences (e.g. FR-6/
FR-7 → AD-2/AD-4/AD-10 covers both "props must be real DS props" and "invalid prop rejected
with feedback" correctly; FR-9 → AD-8 covers the exact grouping semantics FR-9 asks for; FR-13
→ AD-4 covers "one catalog, never diverges" precisely).

## 7. Is every structural dimension this altitude should own decided or deferred?

**Verdict: Mostly, with real silence in two areas: non-catalog error handling, and
build/packaging of the new DS dependency.**

- **IPC/preload wiring**: decided and verified real (Consistency Conventions table, §5 above).
- **Undo/redo, session persistence** (the module's own internal state model, not just the
  DS-swap concern): decided — AD-8 and AD-7 respectively, both concrete and verified against
  real precedent patterns in the codebase. One residual gap noted in §1 (does the FR-2 baseline
  count as an undo step).
- **Error handling**: only *one* class of error is decided — `CapabilityViolation` (AD-10),
  scoped specifically to "requested change isn't in the active DS Adapter's catalog." Left
  completely silent, in both the ADs and the Deferred list:
  - What happens when the agent session itself fails mid-generation or mid-chat-turn (the
    `AgentEvent` union already has an `error` variant at `agentAdapter.ts:175` for exactly
    this — the spine never says how Design Studio surfaces it, vs. how it surfaces a
    `CapabilityViolation`, and these are visibly different failure classes: one is "the agent
    is functioning but the ask is out of catalog," the other is "the agent process died").
  - What happens when `previewProtocol.ts` fails to serve an asset (malformed session state,
    missing DS bundle file)?
  - Per-Tela export failure isolation for FR-15 — asserted in the Capability Map ("falhas
    isoladas") but not backed by any Rule anywhere.
  - Orphaned sessions: AD-7 keys a session by `(specPathHash, workspaceHash)` and treats the
    Spec de UX as read-only — but says nothing about what happens if the Spec file is moved,
    renamed, or deleted out from under a live session (the hash would no longer resolve to
    anything on next open).
- **Deployment/environments**: silent, and this is the more concrete gap. `AD-5` requires
  `previewProtocol.ts` to serve "the DS Adapter's packaged web-component bundle" — but the
  spine never says where that bundle physically lives for the protocol handler to read at
  runtime, in a *built* app rather than `npm run dev`. This is not a hypothetical concern:
  `hive-desktop/electron-builder.yml:12-13` already carries an `asarUnpack: [resources/**]`
  entry specifically because some assets can't be read efficiently (or at all) from inside the
  `asar` archive — and the existing custom-protocol precedent (`whisperProtocol.ts`) sidesteps
  the question entirely by downloading its served files into `userData` at runtime rather than
  shipping them in the app bundle. `@awesome.me/webawesome`'s dist assets are a build-time
  dependency, not a runtime download, so that precedent doesn't transfer, and the spine doesn't
  supply a new answer: is the bundle Vite-imported into the renderer's own asset output, copied
  into `resources/` and unpacked, or read via `require.resolve` against `node_modules` (which
  won't exist unpacked in a packaged build)? Three different builders would plausibly pick
  three different answers, and the difference is invisible until someone tests a packaged
  build, not `npm run dev`. This is a genuine, currently-unaddressed structural dimension at
  exactly the altitude this document owns.

## 8. Are the diagrams valid mermaid, and do they convey real structure?

**Verdict: Yes to both — verified by actually rendering them, not just reading the syntax.**

Extracted both fenced blocks (spine lines 41-53 and 158-177) into standalone `.mmd` files and
rendered them with `@mermaid-js/mermaid-cli` (`mmdc`, v11.16.0, run via `npx`, headless Chromium
with `--no-sandbox`). Both rendered to valid SVG with no syntax errors:

- The `graph TD` component diagram (7 nodes: `UI`, `Skill`, `Agent`, `DS`, `Preview`, `Export`,
  `Session`, `Doc`) uses a mix of shapes meaningfully — `Agent[("AgentAdapter existente")]` uses
  the cylinder/external-system shape correctly to mark `AgentAdapter` as an existing boundary
  the Design Studio module doesn't own, distinguishing it visually from the six Design-Studio-
  owned nodes. Every node has a real, distinct label; none are placeholder text. Edges
  correctly encode the "everything reads through `Doc`/`DS`" invariant the Design Paradigm
  section argues for — e.g. both `Preview --> DS` and `Export --> DS` (not `Preview --> DS`
  and `Export --> (nothing)`), visually reinforcing AD-4/AD-6.
- The `sequenceDiagram` (7 participants, 9 messages) traces one full FR-2 generation flow start
  to finish, with solid arrows for requests and dashed arrows for responses used correctly per
  mermaid convention, and each message annotated with the FR/AD it corresponds to — it reads as
  a real trace of the Design Paradigm section's prose, not a generic template.

Neither diagram is empty, degenerate, or copy-pasted boilerplate; both are load-bearing for the
sections they illustrate.

---

## Summary Table

| # | Item | Verdict |
|---|------|---------|
| 1 | Fixes real divergence points | Mostly — 5 concrete residual ambiguities found |
| 2 | ADs enforceable + prevent stated divergence | Mostly — AD-5/6/7/8/10 strong; AD-2/3/4 convention-only; AD-9 narrower than its intent |
| 3 | Deferred list doesn't hide a real divergence risk | Yes — 7 items all legitimately deferred; 2 unrelated topics are silently absent instead (see #7) |
| 4 | Tech is verified-current | Yes, version/license/framework confirmed live; one Stack-section claim (Pro tier scope) is imprecise |
| 5 | Ratifies the real codebase | Yes on every checked claim; one unacknowledged deviation (`main/designStudio/` subdirectory has zero precedent in `src/main/`) |
| 6 | Covers FR-1–FR-15 | Yes, all 15 present; 2 rows only partially back their FR's testable consequences |
| 7 | No structural dimension left silent | Partial — IPC/undo/session decided; non-catalog error handling and DS-bundle packaging/deployment are genuinely silent |
| 8 | Diagrams valid + convey structure | Yes — both rendered clean with `mmdc`, both load-bearing |
