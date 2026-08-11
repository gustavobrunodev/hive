# design-studio (M18) Validation

**Date**: 2026-08-10
**Spec**: `.specs/features/design-studio/spec.md` (+ `context.md` D-DS-1..4, `design.md`, `tasks.md`)
**Diff range**: `1f36104..71da6d1` — 57 commits, 7 phases, T1.1–T7.8
**Verifier**: independent sub-agent (author ≠ verifier). Read-only over the implementation; every
mutation ran in a scratch copy and was reverted (tree confirmed clean afterwards).

**Verdict: PASS ✅ — with 5 recorded findings, none of them an uncovered acceptance criterion.**

---

## 1. What was actually run (not read)

| Check | Command | Result |
| --- | --- | --- |
| Build gate | `npm run verify` (typecheck → lint → vitest+coverage) | **exit 0 — 3346 passed / 202 files, 0 failed, 0 skipped** — exactly the claimed baseline |
| Flake hunt | `npm test` × 5 + 2 full `verify` runs | **7/7 clean, 3346 every time.** The T7.6 flake did **not** reproduce |
| E2E (real Electron, xvfb) | `playwright test design-studio-{stage,preview,export,keyboard}` | **5 passed (26.0s)** |
| Packaging (D33) | `npm run build:unpack` + a probe that `net.fetch`es the scheme **inside the packaged binary** | **200 for catalog / bundle / receiver, correct CSP** |
| Sensor | 9 behaviour-level mutations, scratch state only | **9 injected, 9 killed, 0 survived** |

Test-integrity: count rose 2548 → 3346 (+798). No suite deleted, no assertion weakened relative to
the M17 baseline that I could find; the three boundary guards run inside `verify`.

---

## 2. Self-reported claims re-derived independently

| Claim | My evidence | Verdict |
| --- | --- | --- |
| Exported `.html` opens with the network off and matches the Preview | Ran `e2e/design-studio-export.spec.ts` myself: passed in 8.3s, every non-`file:` request aborted by `page.route`, `wa-icon` resolved an SVG in its shadow root, and the printed diff was `{"size":"800x104","ratio":0}` | **Confirmed** (see finding F2 on how the claim is worded) |
| `contentWindow.innerWidth === 1440` under a scaled container, in the built app | Ran `e2e/design-studio-stage.spec.ts`: passed. `e2e/design-studio-stage.spec.ts:106-117` asserts `getComputedStyle(frame).width === '1440px'`, `transform === 'none'` on the frame, `0 < scale < 1` on the container, and `window.innerWidth === 1440` evaluated **inside** the frame | **Confirmed** |
| Zero network egress (AD-5 / D32), proven by observed traffic | Ran `e2e/design-studio-preview.spec.ts`: 4 requests observed, all four `hive-studio://…` (shell, `webawesome.css`, `webawesome.js`, `receiver.js`); zero CSP violations | **Confirmed** |
| D33 / `studioResourcesRoot` fixes the packaged app | Built `dist/linux-unpacked` fresh. `asar list` shows `/resources/design-system-web-awesome/*` inside `app.asar`, unpacked to `app.asar.unpacked/resources/`. Launched the **packaged binary** and `net.fetch`ed the scheme from the main process: catalog 118 550 B, bundle 865 438 B, receiver 4 709 B, all `200`, all carrying `connect-src data:; script-src 'self'; …`. `process.resourcesPath` in that binary is `dist/linux-unpacked/resources`, which contains no `design-system-web-awesome/` — i.e. the old root really would have 404'd | **Confirmed, end to end** |
| A flaky unit test exists but was never identified | 7 full-suite runs, all 3346/3346. Scanned the design-studio suites for wall-clock/ordering hazards: only `screenDocument.test.ts:487` (`Date.now()` bracket, monotonic — cannot flake) and three `await new Promise(setTimeout, 0)` yields. **Not reproduced, not identified** | **Unresolved** (finding F4) |
| R-8 still open, honestly recorded | `design.md:497-499` and `design.md:514` say plainly that detection was never calibrated against a real Spec of this repo; `spec.md:474-476` and `ROADMAP.md` repeat the caveat. `screenDetection.test.ts:21-63` is candid that its "real" fixtures are the `bmad-ux` skill's own examples | **Recorded honestly, not overstated** |
| D-DS-4 (`connect-src data:`) is a recorded decision, not a silent relaxation | `context.md:61-87` records it with the measurement (`chunk.ZCZ2WKQR.js:62`), the rationale and the Export argument; `STATE.md:715` carries it as **D32**; `spec.md` P1-Preview AC-2 was amended in place with the reason inline | **Confirmed** |

---

## 3. Spec-anchored acceptance criteria

Every row was located by me; `file:line` is the assertion I read, not a claim from the implementers.

### P1 — Abrir a Spec e ver as Telas (DS-R1)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 open a `design-studio` tab labelled with the basename | kind `design-studio`, label = basename | `src/renderer/src/ui/useEditorTabs.test.ts:92` — `expect(tab.kind).toBe('design-studio')`, `expect(tab.label).toBe('EXPERIENCE.md')`, `expect(tab.spec).toEqual({ path: 'docs/ux/EXPERIENCE.md' })` | ✅ |
| AC-2 list **all** recognised Telas before any generation | every Tela in the selector, zero agent calls | `src/main/designStudio/screenDetection.test.ts:25` — `expect(result.screens.map(s => s.title)).toEqual(['Today','Projects','Project detail','Search','Settings'])`; `src/renderer/src/designStudio/useDesignStudio.test.ts:28` — read lists Telas with the first active, generation is a separate explicit action (`DesignStudioViewer.test.ts:664`) | ✅ |
| AC-3 no Tela → empty state naming what it looked for, never a blank stage | names each probe | `src/renderer/src/designStudio/ScreensEmpty.test.ts:25-27` — `expect(getByText('Nenhuma Tela reconhecida nesta Spec'))`, `expect(probes).toEqual([…'screenHeading','iaTable'…])`; `DesignStudioViewer.test.ts:173` | ✅ |
| AC-4 second open focuses the existing tab | one tab, focused | `src/renderer/src/ui/useEditorTabs.test.ts:109-118` — `expect(tabs.filter(t => t.kind === 'design-studio')).toHaveLength(1)`, `expect(activePath).toBe(first)` | ✅ |
| AC-5 unreadable file → `OperationError` `retryable: true` | `retryable: true` + working retry | `src/renderer/src/designStudio/DesignStudioViewer.test.ts:184-189` — asserts `retryable: true` and that retry re-reads; `ScreensEmpty.test.ts:52-55` renders message + `Tentar de novo` | ✅ |

### P1 — Preview isolado, vivo e imediato

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 `sandbox="allow-scripts"` without `allow-same-origin`, `src` → `hive-studio://`, no `srcDoc` | exactly `allow-scripts` | `src/renderer/src/designStudio/PreviewFrame.test.ts:57` — `expect(frame.getAttribute('sandbox')).toBe('allow-scripts')` + `expect(frame.getAttribute('src')).toBe(URL)` | ✅ |
| AC-2 per-response CSP with **`connect-src data:`** (D-DS-4, supersedes `'none'`) and `script-src 'self'` | header contains `connect-src data:` | `src/main/designStudio/previewProtocol.test.ts:254-255` — `expect(csp).toContain('connect-src data:')`, `expect(csp).not.toContain("connect-src 'none'")`; :273-275 pins `img-src 'self' data:` and no wildcard. Re-measured on the **packaged** binary (§2) | ✅ |
| AC-3 a Command updates by `postMessage`, no renavigation | same `src` after render | `src/renderer/src/designStudio/PreviewFrame.test.ts:188-203` — `expect(posted).toContainEqual({ type:'render', document: DOC, nonce:'abc' })` **and** `expect(frame.getAttribute('src')).toBe(URL)` | ✅ |
| AC-4 in-frame DOM by `createElement` + property assignment, never `innerHTML` | sink absent from the **bundle** | `src/preview/receiver.test.ts:448-467` — rebuilds `resources/design-studio-preview/receiver.js` then `expect(bundle).not.toContain(sink)` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `createContextualFragment`, `DOMParser`, `eval(`, `new Function` | ✅ |
| AC-5 URL-shaped prop outside the allowlist → `CapabilityViolation` before assignment | violation, nothing applied | `src/main/designStudio/dsAdapter/urlSchemeRule.test.ts:111-125` — `expect(adapter.validate(…'javascript:alert(1)'…)).toEqual({ kind:'capability', componentId:'n1', reason:'O esquema "javascript:" não é permitido…', attemptedValue:'javascript:alert(1)' })`; :41-53 covers case, leading space, TAB/LF/CR inside the scheme; :68-75 restricts `data:` to images | ✅ |
| AC-6 random session token, distinct from the disk key | unguessable, not derivable | `src/main/designStudio/previewSessions.test.ts:32-34` — `expect(sessions.open()).not.toBe(sessions.open())`; :57 — token differs from every `(specPathHash, workspaceHash)` derivation; :60-64 the disk key stays deterministic | ✅ |
| AC-7 DS bundle fails to load → `OperationError` with retry on the stage | retryable error surfaced | `src/renderer/src/designStudio/useDesignStudio.test.ts:59-95` — `OperationError` shape surfaced and cleared on reload, non-Error rejections included; `ScreensEmpty.test.ts:43-66` renders retry only when `retryable` | ✅ |

### P1 — Documento por Comandos, com desfazer (DS-R9)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 every change goes through the closed `Command` union and the single reducer | no surface mutates the tree | `src/main/moduleBoundaries.test.ts:586-611` — AST scan of `main/designStudio`, `renderer/src/designStudio`, `src/preview` minus `screenDocument.ts`: `expect(allViolations).toEqual([])`; purity at `screenDocument.test.ts:387-407` | ✅ |
| AC-2 `SetProp` carries exactly one field | `{ componentId, key, value }`, no bag | `src/main/designStudio/types.test.ts` (type-level) + `screenDocument.test.ts:272-288` — two sequential `SetProp`s leave `{ size:'large', variant:'brand' }`; `DesignStudioViewer.test.ts:573` — "dispatches exactly one SetProp, carrying one field" | ✅ |
| AC-3 the reducer applies **without validating** | invalid input applied, no throw | `src/main/designStudio/screenDocument.test.ts:346-380` — `expect(find(next,'bogus')?.tag).toBe('not-a-real-element')`, `expect(find(next,'button')?.props.variant).toBe('roxo')`, unknown slot + undeclared prop both applied | ✅ |
| AC-4 undo recomposes by replay from the origin, no snapshot | deterministic replay | `screenDocument.test.ts:521-573` — prefix replay, `replay(origin, log, 0) === origin`, determinism, call-order independence, clamping, no mutation | ✅ |
| AC-5 a chat turn of N Commands undoes as ONE step | all N revert together | `screenDocument.test.ts:622-629` — after the 2nd undo `expect(log.cursor).toBe(1)` and both `button` and `input` are gone; `designStudioService.test.ts:409-429` at the service level | ✅ |
| AC-6 undoing a chat turn preserves later manual edits | earlier/later manual edits intact | `screenDocument.test.ts:612-620` — 1st undo reverts only the manual `padding`, leaving `variant:'brand'` and `input`; :631-636 the earlier manual edit survives | ✅ |
| AC-7 redo advances exactly one grouped step | one group forward | `screenDocument.test.ts:654-662` — `expect(redone.cursor).toBe(4)`, `input` back, `padding` still undone | ✅ |
| AC-8 a new mid-log edit truncates the redo branch | redo unavailable, entries dropped | `screenDocument.test.ts:712-740` — `expect(redo(branched)).toBe(branched)` and `expect(entries.map(e => e.groupId)).toEqual(['g1','g4'])` | ✅ |

### P1 — Catálogo e Adaptador (DS-R12/R13)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 every layer reads `catalog()`, nobody imports a DS package | no import outside `dsAdapter/` | `src/main/moduleBoundaries.test.ts:683-696` — scans all of `src/`, `expect(allViolations).toEqual([])`; covers value, type-only, dynamic and re-export forms (:619-656) | ✅ |
| AC-2 catalog derived from `custom-elements.json`, with prop **types** and slots | `wa-button.variant` = enum of 5 | `dsAdapter/catalogBuild.test.ts:169` — the five values from the real installed manifest; :189 every prop has one of the four kinds, `values` iff enum; :203 the committed `catalog.json` matches the generated one byte for byte | ✅ |
| AC-3 generation and manual editing share one validation function | same `validate()` | `designStudioService.ts:112-124` is the only dispatch path (used by Inspector, Tree and Chat alike); `designStudioService.test.ts:354-367` — `expect(validate).toHaveBeenCalledTimes(2)` on the shared adapter | ✅ |
| AC-4 out-of-catalog Component/prop → `CapabilityViolation { componentId, reason, attemptedValue? }` | that exact shape | `dsAdapter/webAwesomeAdapter.test.ts:47-150` — unknown tag, nested unknown tag, undeclared prop, out-of-enum value (naming the legal ones), wrong primitive type; `designStudioService.test.ts:338-343` pins the full object incl. `attemptedValue: 'roxo'` | ✅ |
| AC-5 changing the DS needs no code change; existing Telas do **not** migrate | surfaces unchanged; no migration | Non-migration: `webAwesomeAdapter.test.ts:75-86` — a `SetProp` on a node whose tag the active catalog no longer has is refused, not rewritten. "No code change" is carried structurally by the boundary guard + `registry.test.ts:33` (per-id instances) | ⚠️ Spec-precision gap (F3) |
| AC-6 adapter resolved once at boot, never per Tela | same instance, built once | `dsAdapter/registry.test.ts:21-32` — same instance on every call, factory invoked once; `designStudioService.test.ts:282-292` — the thunk is not called until it is needed and then once | ✅ |

### P1 — A Bancada (DS-R3/R4/R5/R16)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 viewport change preserves edit state; active preset visible | state intact, preset on screen | `useDesignStudio.test.ts:160-179` — "opens on Desktop and changes viewport without touching the undo log"; `e2e/design-studio-stage.spec.ts:98,122` — the readout reads `1440 × 900 · N%` / `390 × 844` without opening a menu | ✅ |
| AC-2 leaving and returning to a Tela restores tree, chat and undo cursor | exactly as left | `useDesignStudio.test.ts:180-211` — "returns to a Tela with its log, cursor and transcript exactly as left"; `DesignStudioViewer.test.ts:1024` for the transcript | ✅ |
| AC-3 a Tela with ≥1 user Command is marked edited | distinct from auto-generated | `ScreenList.test.ts:56-77` — distinguished by **shape + icon**, not colour, said in words too; :78 stays marked after undo; `DesignStudioViewer.test.ts:318,621` | ✅ |
| AC-4 clicking any rendered Component, nested included, selects the deepest, no mode | deepest node id | `src/preview/receiver.test.ts` (click via `composedPath()`, deepest `data-hive-node`), `overlay.test.ts:nodeIdFromPath`; `DesignStudioViewer.test.ts:233` highlights the Árvore row | ✅ |
| AC-5 selection is mirrored both ways | Preview ⇄ Árvore | `DesignStudioViewer.test.ts:233` and :252 — both directions; `previewBridge.test.ts:198-216` reports the id, and `null` as `null` | ✅ |
| AC-6 viewport and selection enter neither the undo log nor the session | log and session untouched | `useDesignStudio.test.ts:228-257` — `selects a Component without pushing a step onto the undo log`, `leaves the persisted session untouched when the selection changes` | ✅ |
| AC-7 Focus Mode gives the window to the stage; leaving restores the previous split | the split the user had | `WorkUI.test.ts:2704-2721` — `expect(panelOrder()).toEqual(['viewer'])` then back to `['rail','chat','viewer']` with `expect(resizableProps.defaultLayout).toEqual({ rail:30, chat:45, viewer:25 })` (the dragged split, not defaults) | ✅ |

### P1 — Inspetor (DS-R6)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 only catalog-declared props are listed | nothing else, ever | `Inspector.test.ts:193-226` — exactly the catalog's props; :202 "never offers a prop the document happens to carry but the catalog does not declare"; :216 unknown tag renders nothing | ✅ |
| AC-2 enum → select with exactly the catalog values; boolean → switch; string/number → field | the 5 `wa-button.variant` values | `Inspector.test.ts:152-173` | ✅ |
| AC-3 one `SetProp` per change, Preview reflects with no apply/save | exactly one dispatch | `Inspector.test.ts:287-330` — enum/boolean immediate, text debounced to exactly one; `DesignStudioViewer.test.ts:573` — one `SetProp`, one field, its own group | ✅ |
| AC-4 invalid value → violation rendered in the field, change not applied | document unchanged | `Inspector.test.ts:364-398` — violation lands on the offending prop only and clears on acceptance; `designStudioService.test.ts:130-146` — `expect(JSON.stringify(after.document)).toBe(serialised)` | ✅ |
| AC-5 no selection → empty state that teaches selection | teaching empty, not blank | `Inspector.test.ts:407-443` (four shapes: nothing selected, empty Tela, stale selection, cleared on select) | ✅ |

### P1 — Árvore (DS-R7)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 adding requires choosing from the active catalog | only catalog tags offered | `AddComponent.test.ts` (picker lists catalog tags only); `webAwesomeAdapter.test.ts:47` refuses an unknown tag at the gate | ✅ |
| AC-2 remove/move keep Preview and Árvore consistent, and are undoable | reversible in one step | `designStudioService.test.ts:213-251` — remove then undo restores the whole subtree; move then undo restores the previous document exactly | ✅ |
| AC-3 a move that would create a cycle is refused before dispatch | tree byte-for-byte intact | `designStudioService.test.ts:253-273` — `expect(JSON.stringify(after.document)).toBe(serialised)` **and** `expect(after).toEqual(before)` (nothing pushed); `webAwesomeAdapter.test.ts:261-300` covers self, child and deep descendant | ✅ |
| AC-4 an added Component sits in a slot the parent declares | undeclared slot refused | `webAwesomeAdapter.test.ts:151-204` — incl. "the parent declares no slots at all" and a nested child in an undeclared slot | ✅ |
| AC-5 removing the selected Component clears the selection | selection cleared | `DesignStudioViewer.test.ts:309` — "drops the selection along with the Component it pointed at (DS-R7 AC-5)"; receiver re-measures after render (`receiver.ts:89`) | ✅ |

### P1 — Chat de Iteração (DS-R10/R11)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 selection is the request's default context | Component named in the prompt | `skillDesignSystem.test.ts:557` — prompt names the selected Component by tag and id and scopes to it; :570 falls back to the Tela; :584 falls back when the id is stale; `DesignStudioViewer.test.ts:791,808` | ✅ |
| AC-2 answer parsed into `Command[]`; markup refused | strict envelope | `skillDesignSystem.test.ts:187-260` — markup refused, fenced answers refused, non-envelope refused, unknown Command type refused naming its position | ✅ |
| AC-3 any invalid Command in the batch → **none** dispatched, one `CapabilityViolation` | document byte-for-byte unchanged | `designStudioService.test.ts:318-352` — `expect(JSON.stringify(after.document)).toBe(serialised)`, `expect(after).toEqual(before)`, `canUndo`/`canRedo` unchanged, and the returned object pinned to `{ kind:'capability', componentId:'n1', reason: any(String), attemptedValue:'roxo' }`; first-invalid (:369) and last-invalid (:389) variants too | ✅ |
| AC-4 a wholly valid batch lands as one undo step | one undo takes all N | `designStudioService.test.ts:409-429`; `DesignStudioViewer.test.ts:904` — the three Commands share ONE group id | ✅ |
| AC-5 request the DS cannot satisfy → explanation, no partial change | empty batch + message | `skillDesignSystem.test.ts:174-185` — an empty batch with a message is accepted as the limitation answer; `screenDocument.test.ts:467-475` — an empty batch pushes no undo step | ✅ |
| AC-6 agent failure/expiry → `OperationError` `retryable: true` in the chat | retryable, in the chat | `skillDesignSystem.test.ts:395-410`; `DesignStudioViewer.test.ts:1041-1083` — reported in the chat (not over the Preview) with a retry that re-runs the same request | ✅ |
| AC-7 returning to a Tela brings its transcript back | per-Tela transcript | `DesignStudioViewer.test.ts:1024` — "keeps each Tela's conversation to itself and gives it back on return" | ✅ |
| AC-8 the Skill talks only `AgentSession`/`AgentEvent`, never branching on `agentId` | no `agentId` anywhere | `skillDesignSystem.ts:323-326` — the `SkillAgent` port has `send`/`onEvent` only; `grep -rn agentId src/main/designStudio/` finds it only in that comment. Enforced by the type, not by a runtime assertion | ⚠️ Structural (no assertion; typecheck is the sensor) |

### P1 — Bundle de Exportação (DS-R14/R15)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-1 self-contained HTML, CSS+assets inline, zero network | no URL to fetch | `dsAdapter/staticHtml.test.ts:160-171` — `expect(html).not.toContain('<link')`, `expect(html).not.toMatch(/https?:\/\//)`, `not.toContain('hive-studio://')`; `exportBundle.test.ts:67` on the written file | ✅ |
| AC-2 the Bundle comes from `renderToStaticHtml()`, never a second generator | one producer | `moduleBoundaries.test.ts:745-765` — AST scan of `main/designStudio` minus `dsAdapter/` and the served shell: `expect(allViolations).toEqual([])`; `exportBundle.test.ts:56` writes exactly what the adapter returned | ✅ |
| AC-3 exporting leaves the edit state and session untouched | no Command, no cursor move | `DesignStudioViewer.test.ts:1160` — "dispatches no Command and moves no cursor (DS-R14 AC-3)" | ✅ |
| AC-4 each selected Tela produces its own Bundle | one file per Tela | `exportBundle.test.ts:153-181` — one outcome per Tela in the asked order; two same-titled Telas get distinct filenames | ✅ |
| AC-5 one Tela's failure does not stop the others; the error is scoped to it | 2 files + 1 scoped `OperationError` | `exportBundle.test.ts:126-152` — `expect(readdirSync(dir).sort()).toEqual(['login.html','sucesso.html'])`, `expect(outcomes.map(o => o.ok)).toEqual([true,false,true])`, and the failure pinned to `{ screenId:'s2', title:'Cadastro', ok:false, error:{ kind:'operation', scope:'export', message: containing 'wa-nao-existe', retryable:true } }` | ✅ |
| AC-6 opened offline, the Bundle renders identical to the Preview | identical rendering | `e2e/design-studio-export.spec.ts:154` — run by me: icon resolved with every non-`file:` request aborted, `foreign` requests `[]`, stage diff `ratio: 0` at 800×104 | ✅ (wording: F2) |

### P2 — Sessão persistida · P3 — Modo Foco lembrado

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| P2 AC-1 log, transcript and active Tela persisted per `(specPathHash, workspaceHash)` | round-trips off disk | `sessionStore.test.ts:85-127` — round-trip incl. a fresh store over the same baseDir; :64-83 the key is stable, differs per spec/workspace, and carries neither path verbatim | ✅ |
| P2 AC-2 write is temp-then-rename | no temp left, no partial file | `sessionStore.test.ts:128-137`, :185-200 (rename failure leaves nothing behind) | ✅ |
| P2 AC-3 corrupted session file → fresh session, tab survives | no throw | `sessionStore.test.ts:139-184` — malformed JSON, foreign JSON, non-object, wrong field type, all read as a fresh session | ✅ |
| P2 AC-4 nothing written into the user's workspace; the Spec is read-only | writes only under baseDir | `sessionStore.test.ts:201-211`, :212-222 (a foreign key is a no-op on save) | ✅ |
| P3 AC-1 leaving Focus Mode restores the previous distribution exactly | the user's own split | `WorkUI.test.ts:2704-2721` and :2723-2732 (a layout read from disk comes back untouched) | ✅ |

**Status: 51/51 acceptance criteria located with `file:line` and matched against the spec-defined
outcome. 0 uncovered. 2 flagged (DS-R12 AC-5, DS-R10 AC-8) as structural/precision, not as gaps in
behaviour.**

---

## 4. Edge cases

| Edge case (spec.md §Edge Cases) | Evidence | Status |
| --- | --- | --- |
| 1 Tela → the selector still appears with one entry | `ScreenList.test.ts:34` (no special-casing in `ScreenList.tsx`) | ✅ |
| >20 Telas → the selector scrolls without breaking the stage | `.wb-dstudio-pane { overflow: auto }` (`workbench.css:13765-13770`) — **structural only, no test** | ⚠️ untested |
| empty `Command[]` → no-effect turn, no undo step | `screenDocument.test.ts:467-475`; `designStudioService.test.ts:431-439`; `DesignStudioViewer.test.ts:714` | ✅ |
| malformed JSON → `OperationError`, not `CapabilityViolation` | `skillDesignSystem.test.ts:200-211` | ✅ |
| undo to the origin → empty Tela, undo disabled | `screenDocument.test.ts:538-539`, :646-652 (`undo(log) === log` at cursor 0) | ✅ |
| document with no Component → stage teaches how to add the first | `ScreensEmpty.test.ts:75-101`; `DesignStudioViewer.test.ts:424-433` | ✅ |
| **Spec changes on disk with the tab open → keep the session and signal that the origin changed** | No watcher, no signal, no test anywhere (`grep` for a watch/stale-origin path in `main/designStudio` and `renderer/src/designStudio` returns nothing). The session is preserved only because nothing ever re-reads | ❌ **not handled** (finding F1) |
| two tabs on the same Spec → focus the existing one | `useEditorTabs.test.ts:109-118` | ✅ |
| enum prop set to `null`/empty → "remove the prop" | `screenDocument.test.ts:308-325`; `webAwesomeAdapter.test.ts:145-150` | ✅ |
| the selected Component is removed by the chat → selection cleared before the Preview updates | `receiver.ts:89` re-measures against the new stage; `receiver.test.ts:325` (`expect(byId('n3')).not.toBe(before)`); `DesignStudioViewer.test.ts:309` | ✅ |

---

## 5. Discrimination sensor

Nine behaviour-level mutations, each applied to a scratch copy of one file, the covering suite run,
then the file restored from backup. Depth: **P0-full** (security boundary + data integrity).

| # | File | Mutation | Suite result | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `designStudio/screenDocument.ts` (`undo`) | step back ONE entry instead of one grouped step (AD-8 / DS-R9 AC-5) | 2 failed / 54 passed | ✅ Killed |
| 2 | `designStudio/designStudioService.ts:118` | `if (violation) return violation` → `break`: a refusal no longer aborts the batch (DS-R11 AC-3) | 8 failed / 12 passed | ✅ Killed |
| 3 | `dsAdapter/urlSchemeRule.ts:37` | `normalizeUrl` becomes the identity — case/whitespace/TAB evasion of the scheme allowlist (P1-Preview AC-5) | 3 failed / 9 passed | ✅ Killed |
| 4 | `designStudio/previewBridge.ts:82` | drop the `event.source === contentWindow` control, keep only the nonce (D-DS-4) | 2 failed / 15 passed | ✅ Killed |
| 5 | `designStudio/previewProtocol.ts:153` | response CSP `connect-src data:` → `connect-src *` (P1-Preview AC-2) | 2 failed / 49 passed | ✅ Killed |
| 6 | `designStudio/previewProtocol.ts:129` | remove the path-escape guard from `resolveStudioRequest` | 7 failed / 44 passed | ✅ Killed |
| 7 | `designStudio/exportBundle.ts` (`exportMany`) | let one Tela's failure escape the `catch`, killing the batch (DS-R15) | 5 failed / 12 passed | ✅ Killed |
| 8 | `designStudio/stageScale.ts:41` | drop the `Math.min(1, …)` cap — the stage may magnify and lie about the device (D-DS-7) | 1 failed / 8 passed | ✅ Killed |
| 9 | `preview/receiver.ts:141` | the in-frame receiver starts even with no session token (D-DS-4) | 1 failed / 44 passed | ✅ Killed |

**Result: 9 injected, 9 killed, 0 survived.** Tree verified clean afterwards
(`git status --short -- hive-desktop` empty; see finding F5 for the one artifact that needed an
explicit restore).

**Sensor limitation worth recording:** the AD-2 analyzer (`findDocumentMutations`) keys on writes
through a `.props` / `.children` / `.root` / `.tag` / `.slot` property-access chain. An aliased write
(`const p = node.props; p.variant = 'x'`) would pass it. Blunt is the right trade here, but the guard
is not a proof.

---

## 6. Findings

| # | Severity | Finding |
| --- | --- | --- |
| **F1** | **Major** | **The "Spec changed on disk" edge case is not implemented.** `spec.md:433-435` requires the Studio to keep the session **and signal that the origin changed**. There is no file watcher, no stale-origin state, no i18n string and no test. The first half holds only by accident (nothing re-reads the Spec); the signal simply does not exist. Fix: either implement the signal, or move the line from Edge Cases to a recorded non-goal. |
| **F2** | **Minor** | **"0 pixels diferentes" is overstated in the write-ups.** `spec.md:487-488` and `ROADMAP.md` (M18 exit criteria) both claim a pixel-exact match; the assertion is `expect(diff.ratio).toBeLessThan(0.01)` with a per-pixel tolerance of `delta > 12` (`e2e/design-studio-export.spec.ts:295,310`). Today's run did measure `ratio: 0`, so the claim is true of that run but the gate does not enforce it. Either tighten the assertion to `toBe(0)` or reword the criterion as "no structural difference (<1% of pixels)". |
| **F3** | **Minor** | **DS-R12 AC-5 is only half-measured.** "Telas já criadas SHALL NOT migrar" has a real assertion (`webAwesomeAdapter.test.ts:75`). "Preview, Inspetor e Árvore SHALL continuar funcionando sem alteração de código" has none — no test drives the surfaces against a second adapter; the evidence is the import boundary plus a registry that can hold more than one id. Spec-precision gap: the AC as worded has no observable. |
| **F4** | **Minor** | **The T7.6 flake is still unidentified.** Not reproduced in 7 full-suite runs (5 × `npm test` + 2 × `verify`), 3346/3346 every time. Recording it as "did not reproduce" is honest but it is not closed; if it returns, `useDesignStudio.test.ts:127/294` and `skillDesignSystem.test.ts:500/521` (real `setTimeout(…, 0)` yields) are the first places to look. |
| **F5** | **Minor** | **A unit test rewrites a committed build artifact as a side effect.** `receiver.test.ts:449` runs `scripts/buildPreviewReceiver.mjs` before asserting, so `npm test` overwrites `resources/design-studio-preview/receiver.js` in the working tree. The intent (never test a stale bundle) is right and the output is deterministic — I verified the tree comes back clean after a normal run — but while a source file is being edited, a plain test run silently rewrites a shipped artifact. Worth a note in the test, or a build into a temp dir with the committed file compared rather than replaced. |
| — | Doc nit | `tasks.md:63` (T3.2) still describes the CSP as `connect-src 'none'`, contradicting D-DS-4 / the amended `spec.md` AC-2 and the code. Cosmetic, but it is the row a future reader would trust. |

Nothing in F1–F5 invalidates a shipped behaviour that the spec asserts, which is why the verdict is
PASS rather than FAIL. F1 is the one that deserves a fix task.

---

## 7. Code quality

| Principle | Status |
| --- | --- |
| No features beyond what was asked | ✅ — the surface maps 1:1 onto DS-R1..R18; the only additions found (`pulse`, the width-degradation chain, the Focus-Mode hint) are named in `design.md` §3 |
| No abstractions for single-use code | ✅ — the one port (`DesignSystemAdapter`) is the requirement (DS-R12), not speculation |
| Only touched files required for the tasks | ✅ — the diff outside `designStudio/`, `preview/`, `e2e/`, `resources/`, `tools/visual/` is confined to `useEditorTabs`, `WorkUI`, `Explorer`, `FileSearchDialog`, `icons`, `preload`, `i18n`, `workbench.css` — each an entry point the spec names |
| Matches existing patterns | ✅ — `previewProtocol.ts` follows `whisperProtocol.ts`; `sessionStore.ts` follows `chatHistoryStore`; the guards follow `moduleBoundaries.test.ts` |
| Spec-anchored outcome check | ✅ — 51/51, with the two precision flags above |
| Per-layer coverage expectation | ✅ — domain logic 1:1 with ACs; protocol/security paths have happy + evasion + error cases; the three E2E specs cover the real-Electron paths |
| Every test maps to a spec requirement | ✅ — spot-checked `screenDocument.test.ts`, `designStudioService.test.ts`, `urlSchemeRule.test.ts`, `exportBundle.test.ts`: each describe block cites a DS-R/AC or a listed edge case |
| Documented guidelines followed | ✅ — `docs/visual-validation.md`, `HARNESS.md`, the i18n and reduced-motion guards all run inside `verify` |

Comment quality is unusually high: the load-bearing files explain *why* the control exists and what
breaks without it, which is what let me re-derive the intent without asking anyone.

---

## 8. Requirement traceability

| Requirement | Previous | New |
| --- | --- | --- |
| DS-R1 … DS-R14, DS-R16, DS-R17, DS-R18 | Done | ✅ Verified |
| DS-R15 | Done | ✅ Verified |
| DS-R12 (AC-5 half) | Done | ⚠️ Verified with a precision gap (F3) |
| Edge case "Spec changed on disk" | (implied Done) | ❌ Needs fix (F1) |

---

## 9. Summary

**Overall: ✅ Ready.**

- **Gate**: 3346 passed / 202 files, 0 failed, 0 skipped, exit 0 — the claimed number, reproduced.
- **Spec-anchored check**: 51/51 ACs located and matched; 2 flagged for precision, 0 uncovered.
- **Sensor**: 9 mutations, 9 killed, 0 survived.
- **E2E**: 5/5 green on the real built app, including the three claims that no unit test can make
  (offline Bundle = Preview, `innerWidth === 1440` under a scaled container, zero foreign requests).
- **Packaging**: D33 verified against a freshly built Linux binary, not against a path string.
- **What is not proven**: the Spec-changed-on-disk signal (F1), the >20-Tela scroll (no test), the
  "no code change on DS swap" half of DS-R12 AC-5 (F3), and R-8 — which the team already records as
  open and does not overstate.

**Next step**: one fix task for F1 (implement the origin-changed signal, or demote the line to a
non-goal), and a one-line correction to the "0 pixels" wording in `spec.md` and `ROADMAP.md` (F2).
