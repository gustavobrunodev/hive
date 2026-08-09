---
title: Adversarial Review — Design Studio Architecture Spine
type: architecture-review
target: architecture-design-studio-2026-08-09/ARCHITECTURE-SPINE.md
method: adversarial pairwise divergence
created: 2026-08-09
---

# Adversarial Review — Design Studio Architecture Spine

## Method

For each pair below I construct two units one level below the spine (roughly epic-sized: "the epic building X path") that a builder — possibly a different AI coding agent working somewhat independently, seeing only the spine text — would plausibly produce. Each unit's plausible build is checked against every AD/Rule/Convention in the spine and, where it passes all of them, I show the concrete artifact (a field name, a persistence shape, a validation locus, a race window) where the two units still fail to interoperate. Every pair is therefore evidence of an underspecified Rule, not a violation of an existing one — the fix is either a new AD or a tightened Rule on an existing one, never "read the spine more carefully."

Eleven pairs found. Two explicit questions posed in the review brief are answered inline: **is the `Command`/`ScreenDocument` field-shape gap real?** Yes — see Pair 1 and Pair 9. **Does selection/viewport state interact with undo/redo across a Tela switch in an ambiguous way?** Yes — see Pair 6.

---

## Pair 1 — Inspector's `SetProp` path vs. Skill's chat-applied `SetProp` path

**Units:** the epic building FR-6 (`Inspector.tsx`, manual prop edits) vs. the epic building FR-11 (`skillDesignSystem.ts`, chat-applied edits).

**What each plausibly builds:**
- *Inspector epic*: one field per prop in the catalog schema; each `onChange` dispatches one Command per single field: `{ type: 'SetProp', nodeId, key: string, value: JsonValue }`. This matches AD-8's "a manual edit pushes one step" cleanly — one field change, one Command, one undo step.
- *Skill epic*: a chat turn like "make it primary and large" naturally maps to one component getting several prop changes in one semantic edit. The parser in `skillDesignSystem.ts` emits `{ type: 'SetProp', nodeId, props: Record<string, JsonValue> }` — a bag of changes — since that's the natural shape of what an LLM tool-call / structured-response would emit, and AD-8 already handles grouping at the *command-stack* level, so batching at the *Command* level looks redundant-but-harmless from this epic's vantage point.

**Where they clash:** the spine names `SetProp` in four places (Design Paradigm intro, AD-2, AD-3, Structural Seed) but never once gives it a field list. `screenDocument.ts`'s reducer — one shared file per the Structural Seed — can only accept one shape. Whichever epic's `SetProp` lands first in that file silently becomes the contract; the other epic's already-written dispatch calls fail to typecheck, or (if the reducer is written loosely, e.g. `value: unknown`) typecheck but are misapplied at runtime — a `props` bag arriving where `key`/`value` is expected either sets a literal prop named `"props"` or throws deep inside the reducer with no `CapabilityViolation`, just a crash. The persisted session JSON (AD-7) then also has an ambiguous `Command[]` schema: a session recorded under one shape cannot be replayed or displayed by code written against the other.

**Suggested fix:** Tighten AD-2/AD-3 (or add a short "Command Schema" subsection to the spine, not just names) pinning the literal shape of every union member. Concretely, make `SetProp` always carry a list even for a single field — `{ type: 'SetProp', nodeId: NodeId, changes: Array<{ key: string; value: JsonValue }> }` — so a manual edit is a list of length 1 and a chat batch is a list of length N, and both epics converge on one shape without either having to special-case the other's origin.

---

## Pair 2 — Reducer-as-validator vs. UI-as-validator (where does `CapabilityViolation` actually get thrown?)

**Units:** the epic building FR-6 (Inspector) vs. the epic building FR-11 (Skill).

**What each plausibly builds:**
- *Inspector epic*: does client-side validation before ever calling `dispatch` — reads `DesignSystemAdapter.catalog()`, checks the new value against the prop's accepted type/enum, and only dispatches `SetProp` if valid. If invalid, it renders `CapabilityViolation` locally and never touches the reducer or the undo stack — nothing was applied, so there's nothing to undo. This is the natural reading of "a manual edit pushes one step" (AD-8): invalid edits shouldn't push a step at all.
- *Skill epic*: has no reliable way to pre-validate LLM-produced Commands against the catalog before dispatch (the whole point of the Skill is turning unpredictable prose into Commands), so it dispatches optimistically and expects the *reducer* to validate against `catalog()` and return/throw `CapabilityViolation` if the Command doesn't fit — meaning this epic builds the reducer to be catalog-aware and fallible: `(doc, command, catalog) => Result<doc, CapabilityViolation>`.

**Where they clash:** AD-2's Rule ("the only way any surface changes a Tela is by dispatching a Command through the one reducer") is satisfied literally by both designs, but they've made opposite architectural bets on a question the spine never answers: **is the reducer a pure, always-succeeds function, or a fallible one that owns catalog validation?** If the Inspector epic's assumption (validate outside, reducer always applies) lands in `screenDocument.ts`, the Skill epic's invalid `SetProp` sails straight through and corrupts the tree — silently bypassing AD-10's guarantee for exactly the path (chat) where pre-validation isn't possible. If the Skill epic's assumption lands instead, the Inspector epic's client-side check becomes dead, duplicated catalog-lookup logic sitting next to the "real" check inside the reducer — two independent implementations of "is this prop valid" that can drift out of sync with each other as the catalog format evolves.

**Suggested fix:** Tighten AD-2 (or add AD-2a) to state explicitly: the reducer is the *only* place `CapabilityViolation` can be raised; its signature takes the catalog (or adapter) and returns `{ ok: true; doc } | { ok: false; violation: CapabilityViolation }`; nothing pushes to the undo stack (AD-8) or the session store (AD-7) on the `ok:false` branch. Callers *may* pre-filter for snappier UX but must never treat that pre-filter as sufficient — every Command, regardless of origin, is validated exactly once, in exactly one place.

---

## Pair 3 — Undo/redo mechanism: snapshot-based vs. inverse-command-based vs. replay-from-origin

**Units:** the epic building FR-7 (`ComponentTree.tsx`, Add/Remove/Move) vs. the epic building FR-9 (undo/redo) / the Session Store epic (AD-7).

**What each plausibly builds:**
- *Tree-edit epic*: implements undo the standard command-pattern way — each pushed step stores an *inverse* Command. `MoveComponent`'s inverse is a `MoveComponent` back to the old parent/index (cheap, symmetric). `RemoveComponent`'s inverse is synthesized as an `AddComponent` carrying the exact removed subtree, captured at apply time. This keeps the wire/persisted format as "`Command[]` is the only... representation" (Consistency Conventions) literally true.
- *Session/undo epic*: reads the same Convention line and Structural Seed comment ("Command types, reducer, **undo stack**" — one file, one stack) and, because generically inverting `RemoveComponent`/`MoveComponent` requires knowing pre-mutation state that the bare Command (as named, with no field list per Pair 1) doesn't obviously carry, instead implements undo via full-document snapshots per step: `{ before: ScreenDocument, after: ScreenDocument }`. Simpler, trivially correct, but now the thing actually persisted and pushed per step is *not* `Command[]` — directly at odds with the same Convention line the other epic read literally.

**Where they clash:** AD-7's own Rule says the session JSON holds "document state **and** command history" — two separate things — which is compatible with *either* design (snapshot epic reads it as "current state" + "display log"; inverse-command epic reads "state" as derivable from replaying the command log). Nothing in AD-7 or AD-8 says which one is authoritative for *reconstructing* undo, so the two epics build genuinely different persisted-file schemas for the same session file that `sessionStore.ts` is supposed to be the single owner of (AD-7: "One JSON file per Design Studio session"). Whichever epic's `sessionStore.ts` lands, the other epic's undo/redo logic either can't read old sessions or silently reconstructs the wrong tree (e.g. a `RemoveComponent`'s "inverse `AddComponent`" losing a grandchild's props if the snapshot capture wasn't deep, or a `Move` losing the exact prior sibling index if the epic recorded direction instead of absolute position).

**Suggested fix:** Add an explicit Rule (new AD or extend AD-8) naming the mechanism: e.g. "each undo-stack entry is a `{ forward: Command[]; before: ScreenDocument }` pair — `before` is the full snapshot needed to make Remove/Move losslessly invertible without inventing synthetic inverse Commands; `forward` is kept for display/audit only." Reconcile explicitly with the "`Command[]` is the only... representation" Convention line — either soften it to "…is the only representation of *intent*; snapshots are an implementation detail of undo," or drop snapshot-based undo in favor of a Command shape rich enough to self-invert (which then also resolves Pair 1's `RemoveComponent` field-shape gap: it would need to carry the removed subtree, not just a `nodeId`).

---

## Pair 4 — Session resume vs. mid-lifetime Design System switch: replay determinism

**Units:** the epic building `sessionStore.ts` resume path (AD-7) vs. the epic building the `dsAdapter` registry / FR-12 config switch.

**What each plausibly builds:**
- *Session-resume epic*: on app start, loads the persisted `ScreenDocument` snapshot directly for each session file found and renders it — no replay, no re-validation against the currently active DS Adapter. Fast, simple, and matches AD-7's "disk-is-source-of-truth" framing taken as "disk already holds the truth, just load it."
- *DS-registry epic*: implements FR-12 exactly as specified — "the active Design System is a single config pointer resolved once at startup" (Consistency Conventions) — meaning a user *can* legitimately change the configured DS between app runs (not mid-run). FR-12's own testable consequence explicitly allows this: "Specs de UX e Telas já criadas com um DS não são automaticamente migradas... ao trocar a configuração." This epic doesn't build anything to reconcile old sessions with a new DS because that reconciliation is explicitly out of scope (Deferred section: "nenhum AD cobre conversão entre adapters").

**Where they clash:** neither epic is wrong per its own AD, but nothing assigns a `ScreenDocument` a durable *stamp* of which DS it was authored against. If a third, independently-plausible epic instead implements undo/redo via replay-from-origin (a real reading of Pair 3's ambiguity — replaying `Command[]` from the initial empty tree is the cleanest way to keep "`Command[]` is the only representation" literally true) then resuming a session authored under DS-A, after the user has since switched the config pointer to DS-B, replays DS-A-shaped Commands through DS-B's `catalog()` — producing a cascade of `CapabilityViolation`s (per Pair 2) *on load*, for components that were perfectly valid when created. The snapshot-loading epic has no such failure mode on load, but silently renders stale DS-A markup through a DS-B-configured Preview Host (AD-5) the moment any edit touches it, which is a *different* undefined failure mode. Both are "spine compliant"; both mishandle the exact scenario the PRD flags as a known non-goal, because neither epic was told which failure mode is acceptable, or given a field to detect the mismatch at all.

**Suggested fix:** Add a Rule to AD-7 that `ScreenDocument` (or the session envelope) is stamped with the DS Adapter id/version it was authored against; session resume loads the snapshot directly (never replays commands to reconstruct state — this also resolves Pair 3 in the snapshot epic's favor); on load, if the stamp doesn't match the currently active DS Adapter, the session opens in a clearly-marked read-only/stale state rather than either crashing on replay or silently rendering through the wrong adapter.

---

## Pair 5 — `CapabilityViolation` scope: AD-10's binds list vs. the Consistency Conventions' blanket claim

**Units:** the epic building FR-14/FR-15 (`exportBundle.ts`) vs. the epic building FR-6/FR-11 (Inspector + Skill, the actual AD-10 owners).

**What each plausibly builds:**
- *Export epic*: reads the Consistency Conventions table verbatim — "Errors surface only as `CapabilityViolation` (AD-10)" is written with no FR qualifier, unlike AD-10's own header which explicitly binds only FR-6/FR-11/FR-13. Taking the Convention at face value, this epic wraps *every* export-time failure — a filesystem write error, `renderToStaticHtml` throwing on an asset it can't inline, a permissions error — as `CapabilityViolation { componentId, reason, attemptedValue? }`, forcing `componentId` to be populated with something meaningless (`"__export__"`?) for failures that have nothing to do with a component/prop capability mismatch.
- *Inspector/Skill epics (the actual AD-10 owners)*: build `CapabilityViolation` narrowly, exactly as AD-10 describes it — sourced from `DesignSystemAdapter.catalog()` validation, with `componentId` always meaningful because it always names the component whose prop/child was rejected.

**Where they clash:** this is a contradiction inside the spine text itself, not just an inference gap — AD-10's own `Binds` line scopes it to three FRs, while the Consistency Conventions table states the same shape is "the only rejection/limitation shape" system-wide. A builder reading only the Conventions table (plausible — it's the summary table meant to be skimmed) ships IO-level export failures shoehorned into a shape designed for catalog mismatches; a builder reading only AD-10 ships export failures in some ad hoc, unspecified shape (`{ telaId, error: string }`?) since nothing else names one. FR-15's own testable consequence — "uma falha ao exportar uma Tela não impede a exportação das demais" — needs *some* per-Tela failure shape to report back to the UI, and the spine gives two different, both-textually-supported answers for what it should be.

**Suggested fix:** Either (a) broaden AD-10 to genuinely be the one system-wide error shape, adding an optional discriminant (`kind: 'catalog' | 'io' | 'agent'`) so `componentId`/`attemptedValue` become meaningful-when-present rather than always-required, and update its `Binds` line to include FR-14/FR-15; or (b) narrow the Conventions table line to "Catalog-driven rejections surface only as `CapabilityViolation` (AD-10); Export failures use `ExportFailure { telaId, reason }` (new, add to spine)." Either fix is fine — what's not fine is leaving both statements in the document simultaneously, since they license two incompatible builds.

---

## Pair 6 — Selection-state ownership across Preview, Tree, and Inspector — and what happens on a Tela switch or a Remove

**Units:** the epic building FR-5 (`PreviewPane.tsx`, click-to-select) vs. the epic building FR-7 (`ComponentTree.tsx`, the layers/outline panel).

**What each plausibly builds:**
- *Preview epic*: keeps `selectedNodeId` as local state inside `PreviewPane.tsx`. Since the iframe is sandboxed without `allow-same-origin` (AD-5), the only channel out is `postMessage`; a click inside the iframe posts the clicked node's id, `PreviewPane` sets its own state, and passes `selectedNodeId` down as a prop to `Inspector.tsx`. This alone satisfies FR-5 and the Convention's "selection is transient UI state, not part of `ScreenDocument`."
- *Tree epic*: `ComponentTree.tsx` also needs to show which node is selected (a layers panel with no selection highlight is a broken outliner) and plausibly also lets the user select *from* the tree by clicking a row — a completely reasonable, spine-compliant reading of "selection is transient UI state" that assigns no single owner. This epic keeps its own `selectedNodeId` state locally, independent of `PreviewPane`'s.

**Where they clash:** the Structural Seed lists no shared selection store or context provider — `DesignStudioViewer.tsx` is described only as "registered as `EditorTabKind` (AD-1)," not as an owner of cross-pane state. Two independently-plausible, spine-compliant local-state implementations desync the instant a user selects via one surface and expects the other to reflect it (click a card in Preview, Tree shows no highlight). Worse, on FR-4's Tela switch — which the spine requires *not* to lose "the state of edition of each Tela" but never says whether selection should reset — a `selectedNodeId` captured under the old Tela can persist across the switch (if either epic scoped its state to the *component instance*, which survives the switch, rather than to the *active Tela*, which changes), leaving `Inspector.tsx` trying to render props for a node id that doesn't exist in the new Tela's tree. The same failure mode recurs without any Tela switch at all: if the Skill epic's `RemoveComponent` (Pair 3) deletes the currently-selected node, nothing in either epic clears the now-dangling `selectedNodeId`, since neither the Preview epic nor the Tree epic is watching the *other's* mutation source (chat-applied Commands) for that side effect.

**Suggested fix:** Add a Rule (extend AD-1 or add a new AD) naming a single owner for `{ activeTelaId, selectedNodeId }` — most naturally `DesignStudioViewer.tsx`, passed down as props/context to Preview, Tree, and Inspector alike — with two explicit invalidation rules: reset `selectedNodeId` to `null` whenever `activeTelaId` changes, and clear it whenever a dispatched Command removes the node it currently points at (a cheap post-dispatch check: does `selectedNodeId` still resolve in the new tree?).

---

## Pair 7 — Chat-turn Command batch atomicity vs. FR-11's "no partial change" guarantee

**Units:** the epic building FR-11 (`skillDesignSystem.ts` applying parsed Commands) vs. whichever epic builds the "apply a grouped batch" dispatch helper AD-8 implies.

**What each plausibly builds:**
- *Skill-application epic*: applies the chat turn's `Command[]` to the reducer one at a time in a loop (the natural way to consume a list), tagging them afterward as one undo group per AD-8's "all Commands emitted by one chat turn push as a single grouped step." If Command #3 of 5 returns `CapabilityViolation` (per Pair 2), Commands #1–2 are already applied to the live tree; the loop stops and surfaces the violation as a chat error message.
- *Batch/undo-grouping epic* (or a stricter reading of the same code by a second builder): reads AD-8's "single grouped step" as *atomicity*, not just undo bookkeeping, and implements a dry-run-validate-then-commit: validate every Command in the batch against the catalog first, and only mutate the tree + push one undo step if all of them pass; otherwise reject the whole batch and surface one `CapabilityViolation`.

**Where they clash:** the first design ships a real product bug that's also a spine violation one level up: FR-11's explicit testable consequence is "responde explicando a limitação **em vez de aplicar uma mudança parcial ou incorreta**." The sequential-apply-with-no-rollback design does exactly the forbidden thing — it applies a partial change — while remaining fully consistent with AD-8's literal text ("push as a single grouped step" says nothing about atomicity of *application*, only of *undo grouping*). Because AD-8 and FR-11 are never explicitly cross-referenced in the spine, a builder implementing AD-8 in isolation (plausible, since it's the AD that "belongs" to undo/redo) has no textual signal that FR-11's constraint even applies to how they write the batch-apply loop.

**Suggested fix:** Tighten AD-8's Rule to require atomic (all-or-nothing) application of a chat turn's `Command[]` batch — nothing reaches the tree or the undo stack unless the entire batch validates — and explicitly cross-reference FR-11 so the two requirements are read together. This also requires Pair 2's reducer validation to support a dry-run/`validateOnly` mode, or requires `skillDesignSystem.ts` to pre-validate the full batch against `catalog()` before dispatching any of it.

---

## Pair 8 — Runtime document state: singleton vs. per-session-keyed, under multi-tab concurrency

**Units:** the epic building `designStudioService.ts` (the IPC facade wiring `screenDocument.ts` to `window.hive.designStudio.*`) vs. the epic building `DesignStudioViewer.tsx` under AD-1.

**What each plausibly builds:**
- *Facade epic*: reads AD-2/AD-8's singular phrasing ("the one reducer," "the undo stack," "Each Tela owns one command stack") and, absent any explicit multi-session instruction, builds the simplest thing that satisfies it: one module-level `currentDocument`/`currentStack` in `screenDocument.ts`, refreshed whenever a Tela is opened.
- *Multi-tab UI epic*: AD-1's own Rule says "One tab per Spec de UX" — which, read plainly, means a user opening a second Spec de UX gets a *second* tab, open concurrently with the first, each independently editable (nothing in AD-1 says opening a new Design Studio tab closes the old one). This epic builds `DesignStudioViewer.tsx` and the renderer-side dispatch call sites assuming full concurrent isolation between tabs — undo in Tab A must never affect Tab B.

**Where they clash:** a singleton runtime `screenDocument.ts` cannot serve two concurrently open tabs without cross-talk. If Tab A is mid-flight on a chat-generated batch (an async agent call per AD-9, taking "multiple seconds") when the user switches focus to Tab B and makes a manual edit, and the facade epic's singleton design swaps `currentDocument` to Tab B's Tela when the tab gains focus, then Tab A's async Skill response — still in-flight, and unaware the singleton has moved on — lands afterward and gets applied to whatever `currentDocument` now is: Tab B's tree, not Tab A's. AD-7's persistence layer is explicitly session-keyed by `(specPathHash, workspaceHash)`, but nothing says the *in-memory* runtime layer mirrors that keying — it's implied by good taste, never stated as a Rule.

**Suggested fix:** Tighten AD-1 or AD-8 with an explicit Rule: the main-process runtime holds a `Map<SessionKey, { document, commandStack }>` keyed identically to AD-7's persistence key (extended with `telaId`), and every `designStudio:*` IPC call is parameterized by that key — never routed through an implicit "currently focused" singleton.

---

## Pair 9 — Session persistence vs. in-memory apply: write-ordering race under rapid undo/redo or batched chat edits

**Units:** the epic building the reducer/dispatch path (FR-8's "instantaneous" reflection requirement) vs. the epic building `sessionStore.ts` (AD-7).

**What each plausibly builds:**
- *Reducer/dispatch epic*: applies Commands synchronously to in-memory state and pushes to Preview immediately — FR-8 explicitly requires this to feel instantaneous, "sem reload completo da Tela," so nothing here waits on disk I/O.
- *Session Store epic*: implements AD-7's "write-temp-then-rename pattern" (mirroring `chatHistoryStore.ts`) triggered on every command dispatch, as the natural way to keep disk current. Nothing in AD-7 specifies debouncing, coalescing, or ordering guarantees across overlapping writes to the same session file.

**Where they clash:** the prompt's own hinted race — a rapid sequence of undo/redo clicks, or a single chat turn applying five grouped Commands within milliseconds (Pair 7) — triggers five write-temp-then-rename cycles in quick succession. Nothing enforces that write #2's rename can't complete before write #1's does (both are independent async fs operations unless explicitly serialized), so the file on disk can end up reflecting an *earlier* in-memory state than the one the user is currently looking at, or — worse — reflecting state from a since-undone step if an undo and a subsequent redo race two writes in the wrong order. This is invisible to either epic's own unit tests, since each plausibly mocks the other side (the reducer epic doesn't test against real disk timing; the store epic doesn't test against rapid-fire dispatch), and only shows up on integration as "reopened the app and my last few edits from the previous session were gone."

**Suggested fix:** Tighten AD-7 with an explicit Rule: session writes are serialized through a single per-session async queue (each write waits for the prior write's rename to complete before starting, or — more simply — writes are debounced with only the latest state ever persisted, since intermediate states don't need durability, only the final one per burst) and/or each write is stamped with a monotonically increasing sequence number so a straggling write can detect it's stale and no-op rather than clobbering newer data.

---

## Pair 10 — Preview's `renderToDom` vs. Export's `renderToStaticHtml`: asset-inlining strategy inside one shared adapter file

**Units:** the epic building `previewProtocol.ts` + the Preview-facing half of `webAwesomeAdapter.ts` (AD-5) vs. the epic building `exportBundle.ts` (AD-6).

**What each plausibly builds:**
- *Preview epic*: registers `hive-studio://` to serve the DS bundle as static assets at a fixed path (e.g. `hive-studio://app/ds-bundle.js`), and implements `renderToDom()` to reference that bundle by URL inside the custom-protocol origin — perfectly fine per AD-5, since the iframe is already same-origin against that scheme.
- *Export epic*: calls the *same* adapter's `renderToStaticHtml()`, per AD-6's explicit requirement to reuse "the same adapter method family," to satisfy FR-14's "autocontido... não depende de recursos de rede." If this epic is built by extending the Preview epic's already-landed `webAwesomeAdapter.ts` under time pressure, the path of least resistance is reusing the same "reference by URL" helper the Preview code path already has working — producing a `renderToStaticHtml()` output that still contains `hive-studio://...` URLs.

**Where they clash:** AD-4/AD-6 say the two render methods live on the same adapter and must not diverge in DS *knowledge* (which components exist, how props map) — but say nothing about asset-resolution strategy needing to *differ* between the two methods. A `hive-studio://` URL is meaningless outside a running Hive Desktop process; the Figma Agent (an external tool, per the PRD glossary) cannot resolve it. Export epic's output would pass every in-app spine check (it did call `renderToStaticHtml`, it did reuse the adapter, per AD-6's letter) while silently failing FR-14's actual testable consequence the moment the file leaves the app.

**Suggested fix:** Extend AD-6 (or AD-4) with an explicit Rule that `renderToDom` and `renderToStaticHtml` are required to use *different* asset-resolution strategies — the former may reference `hive-studio://`-served assets, the latter must inline everything (base64 data URIs / embedded `<style>`/`<script>`) with zero external URL references of any scheme — and flag that even though `webAwesomeAdapter.ts` is one file, its two render paths must not share an asset-referencing helper that leaks scheme-relative URLs into the export path.

---

## Pair 11 — Raw agent text vs. parsed-Command chat transcript: which channel does `IterationChat.tsx` actually render?

**Units:** the epic building `skillDesignSystem.ts` / prompt design (AD-3, AD-9) vs. the epic building `IterationChat.tsx` (FR-10).

**What each plausibly builds:**
- *Skill/prompt epic*: to keep parsing reliable, designs the agent's response format as a single structured payload — e.g. a fenced JSON block that *is* the `Command[]`, nothing else in the response needs to be user-facing. `skillDesignSystem.ts` parses it and synthesizes its own short confirmation string ("Applied: cards side by side") for whatever surfaces that in the chat.
- *Chat UI epic*: reads AD-9's "routed through `AgentSession`/`AgentEvent`... exactly like the main chat," and the PRD's explicit framing ("a experiência-alvo é a de iterar em um artifact do Claude... descrever o ajuste, ver o resultado refletido ao lado, continuar a conversa") as license to wire `IterationChat.tsx` directly to streaming `AgentEvent` text deltas, exactly like the main chat panel does today — showing the agent's natural-language reply verbatim, live, as it streams.

**Where they clash:** if `IterationChat.tsx` streams the raw `AgentEvent` text (its epic's plausible reading of AD-9), and the Skill epic's prompt design asks the agent to respond with a raw fenced-JSON `Command[]` block and nothing else (its epic's plausible reading of AD-3 — "markup is never accepted as a Skill response" is about what reaches the *reducer*, not about what's shown in chat), the user sees raw unparsed JSON scroll through the Iteration Chat transcript instead of a natural-language confirmation — directly contradicting the PRD's own "artifact do Claude" experience target this feature exists to deliver. AD-9's "no backend-specific branching" also leaves open whether the Skill can rely on a given agent's native tool-calling (which may not be uniformly available across the Claude/Devin/Copilot-CLI adapters this same AD requires treating identically) versus a plain-text convention parseable regardless of backend — a choice that directly determines whether anything "leaks" into the visible stream.

**Suggested fix:** Add a Rule to AD-3 (or AD-9) naming the exact channel: `IterationChat.tsx` never subscribes to raw `AgentEvent` text directly — it only renders messages `skillDesignSystem.ts` explicitly emits after parsing, whether that's the response with the structured block stripped out or a synthesized summary. This also settles the tool-calling-vs-plain-text-convention question by making it purely an implementation detail behind `skillDesignSystem.ts`, invisible to the UI either way.

---

## Summary Table

| # | Pair | Gap | Severity |
| --- | --- | --- | --- |
| 1 | Inspector `SetProp` vs. Skill `SetProp` | `Command` field shape unspecified | High |
| 2 | Inspector validation vs. Skill validation | Reducer purity / `CapabilityViolation` origin unspecified | High |
| 3 | Tree-edit undo vs. Session undo | Undo mechanism (snapshot/inverse/replay) unspecified, contradicts "`Command[]` only" convention | High |
| 4 | Session resume vs. DS-registry switch | No DS-authorship stamp on `ScreenDocument`; replay determinism undefined | Medium |
| 5 | Export errors vs. Inspector/Skill errors | `CapabilityViolation` scope: AD-10 binds vs. blanket Convention text contradict each other | Medium-High |
| 6 | Preview selection vs. Tree selection | No named owner of cross-pane selection state; no invalidation rule on Tela-switch or Remove | Medium |
| 7 | Skill batch-apply vs. batch/undo grouping | Chat-turn atomicity unspecified; plausible build violates FR-11's "no partial change" | Medium-High |
| 8 | Facade singleton vs. multi-tab UI | Runtime document state not session-keyed; cross-tab race | Medium |
| 9 | Fast in-memory apply vs. async disk persistence | No write-ordering/serialization guarantee in AD-7 | Medium |
| 10 | Preview render vs. Export render | Shared adapter file, unspecified diverging asset-inlining requirement | Low-Medium |
| 11 | Raw agent stream vs. parsed-Command transcript | No named channel boundary between `AgentEvent` and `IterationChat.tsx` | Low-Medium |
