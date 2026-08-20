# Tasks — Second Brain

**Design:** `design.md` · **Spec:** `spec.md` · **Context:** `context.md`
**Status:** ✅ DONE — all T1–T22 shipped 2026-07-26 on `feat/second-brain`
(branched off `feat/agent-change-review`/M11, unmerged). Reuses M8 rebind, M10
`FileTree`, M11 `SidebarHost`/`launchAction`. ROADMAP **M12**; STATE **D24**.

Completed: T1 ✅ T2 ✅ T3 ✅ T4 ✅ T5 ✅ T6 ✅ T7 ✅ T8 ✅ T9 ✅ T10 ✅ T11 ✅
T12 ✅ T13 ✅ T14 ✅ T15 ✅ T16 ✅ T17 ✅ T18 ✅ T19 ✅ T20 ✅ T21 ✅ T22 ✅

**Gates:** `npm run verify` green — typecheck + **0 lint errors** + **1507**
unit/component tests (baseline 1299, +208). Every changed non-UI file ≥90%;
every `secondBrain/` renderer file 100% statements/functions/lines.
`noInlineStrings` green (all copy pt-BR via `t()`). Real-Electron E2E
(`e2e/second-brain.spec.ts`) passes under xvfb alongside `agent-change-review`
and `app-launch`; 11 Playwright-MCP screenshots in dark + light under
`.playwright-mcp/second-brain-{dark,light}-*.png`.

Notes on task seams and deviations:
- **T1/T2 both corrected the design**, which is what spikes are for. T1: the
  skill repo ships FOUR skills, so the install flag is `--skill '*'`, not
  `--skill second-brain`. T2: four pinned Whisper corrections (`corsEnabled`,
  host-based scheme, same-origin ORT assets, fp32-on-WASM). Both recorded in
  STATE.md before anything was built on them.
- T7 and T8 landed in one commit — the wiki browser is a section of the same
  `SecondBrainPanel`, so splitting would have meant committing a knowingly
  incomplete panel.
- T9 shipped the FAB component alone; its "mount in WorkUI" half moved to T10,
  which mounts it together with the sheet its modes open (mounting at T9 would
  have committed dead wiring).
- T15/T17 changed T10's design slightly: the transcript field is **shared by
  every mode**, not text-tab-only — that is what makes "edit before ingest"
  work for a transcription.
- T20 also fixed two defects the visual pass found (pane header, duplicated
  wiki index) and added a "Continuar mesmo assim" escape *during* provisioning.
- Four older E2E specs fail in this sandbox on the BMAD CLI; verified
  pre-existing against the branch base in a clean worktree (STATE.md lesson).

Atomic, ordered by dependency. Each task = one focused change + its tests + one
atomic commit. Verification is concrete (a command or an observable). `[P]` = can
run in parallel with siblings once its deps are met.

Prereq every task: `source ~/.nvm/nvm.sh && nvm use` (reads `.nvmrc`; STATE lesson —
nvm doesn't persist across tool calls). A fresh worktree also needs
`@hive/design-system` built first (STATE lesson).

**Conventions (user rules, verbatim):** UI tasks use the `impeccable` skill (product
register) + DS role tokens; the visual task uses the **Playwright MCP** (dark+light);
free to extend/create DS components where needed (D-SB-9). Every string via `t()`
(pt-BR) — `noInlineStrings` is part of each UI task's verify. Non-UI files hold
**≥90% per-file coverage**; large renderer shells follow the SkillStudio/McpManager
gating precedent.

Legend: **Dep** = task ids that must land first. **SB-R** = requirement(s).
**Verify** = pass condition.

---

## Execution Plan

```
Phase 0 — Spikes (de-risk before building)
  T1  skills-CLI spike        T2  Transformers.js/CSP spike     (both [P])

Phase 1 — Provisioning spine (main + gate)
  T1 ─→ T3 ─→ T4 ─→ T5                                  ◀── demoable: gate installs/updates second-brain

Phase 2 — Vault sidebar view (renderer)
  T5 ─→ T6 ─→ T7 ─→ T8                                  ◀── demoable: browse vault + launch commands

Phase 3 — Text ingestion via FAB
  T6 ─→ T9 ─→ T10                                       ◀── demoable: FAB → paste → raw write + ingest

Phase 4 — Whisper engine + audio-file ingestion
  T2 ─→ T11 ─→ T12 ─→ T13 ─→ T14 ─→ T15                 ◀── demoable: file → transcript → ingest

Phase 5 — Live recorder
  T14 ─→ T16 ─→ T17                                     ◀── demoable: record → transcript → ingest

Phase 6 — Model manager + hardware recommendation (P2)
  T12 ─→ T18 ─→ T19

Phase 7 — Quality
  T20 (E2E) ─→ T21 (visual) ─→ T22 (closeout)
```

---

## Phase 0 — Spikes

### T1 [P] — Spike: real `skills` CLI install/update
**Dep:** — · **SB-R:** R1.1, R1.2
Run `npx -y skills add https://github.com/nicholasspisak/second-brain --skill
second-brain -a claude-code -y` in a throwaway workspace (cwd = that dir). Confirm:
non-interactive flags; the exact **update** subcommand (`skills update` vs re-`add`);
that it writes `.claude/skills/second-brain/SKILL.md` + the four sub-skills; capture
stdout markers for the parser. **Verify:** SKILL.md present on disk; findings +
fixtures recorded in STATE.md (OQ1 closed) before T3.

### T2 [P] — Spike: Transformers.js in the Electron renderer under CSP
**Dep:** — · **SB-R:** R4.1
Add `@huggingface/transformers`; bundle ORT WASM assets locally; add
`'wasm-unsafe-eval'` + `hive-model:` to CSP; register the `hive-model:` protocol
serving a hand-placed `whisper-tiny` model dir from userData. Transcribe a 3 s WAV
via `env.localModelPath='hive-model:///'` on **both** WebGPU and WASM. **Verify:**
a real transcript prints from a local-only model (no network); OQ2/OQ3 closed and
recorded in STATE.md. Throwaway scaffold; keep only the proven config for T11.

---

## Phase 1 — Provisioning spine

### T3 — `secondBrainService.ts` (install/update/detect/resolveVault)
**Dep:** T1 · **SB-R:** R1.1, R1.2, R1.3
Mirror `bmadService.ts` (DI `ProcessRunner`; `SkillEvent` stream; line-buffered
parser from T1 fixtures). `detect(ws)`, `install(ws)`, `update(ws)`,
`resolveVault(ws)`. **Verify:** unit tests (fake runner, temp dir) ≥90%; install
emits `done` on exit 0, `error` on non-zero; detect true/false correct.

### T4 — IPC + preload for `secondBrain.{install,update,isProvisioned,getVault,stageRaw}`
**Dep:** T3 · **SB-R:** R1, R2.5, R3.2
Also add `secondBrainVault.ts` (`stageRaw`, `countRawPending`, path-guarded) here.
Wire `ipcMain` handlers/streams (install/update follow the `bmad:update:*` streamed
pattern) + preload `secondBrain` namespace + `secondBrainTypes.ts`. **Verify:**
index.test.ts handler tests; `stageRaw` writes a timestamped `raw/*.md`, refuses
empty, no same-second collision; preload `.d.ts` imports only pure type modules.

### T5 — Provisioning gate extension (BMAD → second-brain)
**Dep:** T4 · **SB-R:** R1.3, R1.4
Extend the `App.tsx` provisioning gate to run second-brain install/update after
BMAD, same "Preparando o workspace" surface, fail-soft ("continuar mesmo assim").
New `secondBrain` i18n block. **Verify:** component test drives the gate through a
scripted `SkillEvent` stream (install path + update path + error→continue); reaches
work UI in all three.

---

## Phase 2 — Vault sidebar view

### T6 — Activity-bar `'brain'` view + `SidebarHost` slot + `BrainIcon`
**Dep:** T5 · **SB-R:** R2.1, R2.5
Extend `SidebarView` union, add `RailViewButton` (icon + `rawPending` badge,
`aria-keyshortcuts=Control+Shift+B`), `SidebarHost.brain` slot, `WorkUI` wiring +
`activeView` handling. **Verify:** ActionRail/SidebarHost tests updated; layout
(`hive.workLayout`) untouched; badge shows/hides on count.

### T7 — `SecondBrainPanel.tsx` — empty state + action launchers
**Dep:** T6 · **SB-R:** R2.2, R2.4
Empty state ("Configurar base" → `/second-brain`), and the Ingerir/Consultar/
Organizar action row via `launchAction` (prompts in a `secondBrainPrompts.ts`,
mirroring `studioPrompts.ts`). **Verify:** tests assert each action launches the
correct slash command; empty state renders when `getVault` → `path:null`.

### T8 — `SecondBrainPanel` vault browser (index + wiki tree)
**Dep:** T7 · **SB-R:** R2.3
Render `wiki/index.md` via the Markdown viewer + a `wiki/` `FileTree` (reuse
`explorer`), open files in the editor on click; rebind on workspace switch (M8).
**Verify:** with a fixture vault, index + tree render and a click opens the file;
switching workspace clears/rebinds.

---

## Phase 3 — Text ingestion via FAB

### T9 — `SecondBrainFab.tsx` (floating button + mode menu)
**Dep:** T6 · **SB-R:** R3.1, R3.5
Fixed FAB outside the resizable body, offset above the composer, focus-visible,
`aria-haspopup`; menu with the three modes. Mount in `WorkUI`. **Verify:** tests for
menu open/keyboard/focus; visual placement checked in T21; does not disturb layout.

### T10 — `IngestPanel.tsx` — text tab → raw write + launch ingest
**Dep:** T9, T4 · **SB-R:** R3.2, R3.3, R3.4
Sheet with the text tab (editable textarea), empty→disabled confirm, no-vault guard
(offer "Configurar base"), **Ingerir** → `stageRaw` + `launchAction('/second-brain-ingest')`.
(Audio/record tabs are stubbed until Phase 4/5.) **Verify:** tests: empty disabled;
no-vault path; ingest writes `raw/*.md` + launches the turn (mocked bridge).

---

## Phase 4 — Whisper engine + audio-file ingestion

### T11 — Wire the proven Transformers.js config (from T2) into the app build
**Dep:** T2 · **SB-R:** R4.1
Land the CSP additions, `hive-model:` protocol (`whisperModelStore` protocol
handler), and ORT `wasmPaths` config permanently (not spike scaffold). **Verify:**
app boots with the new CSP; protocol serves a placed model file; no console CSP
violations (checked via the Playwright-MCP boot).

### T12 — `whisperModelStore.ts` (catalog + download/delete/status) + IPC/preload
**Dep:** T11 · **SB-R:** R4.2, R7.2
Static catalog (the user's table), userData store, `downloadModel` (HF tree API →
temp dir → atomic rename, streamed progress), `deleteModel`, `status`; `whisper.*`
IPC + preload + `whisperTypes.ts`. **Verify:** unit tests (fake fetch + temp dir)
≥90%: atomic finalize, interrupted download not "downloaded", path-escape guarded,
progress emitted.

### T13 — `whisper/audio.ts` — decode + resample to 16 kHz mono Float32
**Dep:** T11 · **SB-R:** R4.1
WebAudio `decodeAudioData` + `OfflineAudioContext` resample; typed error on
unsupported/corrupt audio. **Verify:** unit test with a synthetic buffer asserts
length/sample-rate/mono; bad input rejects.

### T14 — `whisper/useWhisper.ts` — pipeline (WebGPU/WASM), model-load progress, transcribe
**Dep:** T12, T13 · **SB-R:** R4.1, R4.2, R4.4
Lazy warm pipeline via `env.localModelPath` scheme; WebGPU→WASM fallback;
`progress_callback` for model load; `transcribe(float32, { language, task })`; if the
selected model isn't downloaded, trigger `whisper.downloadModel` first. **Verify:**
unit test mocks `@huggingface/transformers`, asserts device selection, download-then-load
ordering, language default (Portuguese).

### T15 — `IngestPanel` audio-file tab + model selector
**Dep:** T14, T10 · **SB-R:** R4.3, R4.4, R4.5, R4.6
File picker → `audio.ts` → `useWhisper` (download progress if needed) → editable
transcript → **Ingerir** (shared path). Model selector (default `base`) + link to
Model Manager. Error surface (SB-R4.6). **Verify:** tests: transcript fills the
field (mocked whisper), edit-before-ingest works, ingest writes raw + launches;
error state renders.

---

## Phase 5 — Live recorder

### T16 — Media permission handler (main) + `AudioRecorder.tsx`
**Dep:** T14 · **SB-R:** R5.1, R5.3, R5.4
`session.setPermissionRequestHandler` granting only `media`; recorder UI
(`getUserMedia`/`MediaRecorder`, record/stop, timer, level meter), re-record
discards + stops tracks, permission-denied message + retry. **Verify:** tests mock
`getUserMedia`/`MediaRecorder`; denied path shows retry; tracks stopped on re-record/unmount.

### T17 — Recorder tab wired into `IngestPanel`
**Dep:** T16, T15 · **SB-R:** R5.2, R5.5
Record → Blob → `audio.ts` decode → `useWhisper` → editable transcript → shared
ingest path. **Verify:** test: stop → transcript (mocked) → ingest writes raw +
launches.

---

## Phase 6 — Model manager + hardware recommendation (P2)

### T18 — `whisperHardware.ts` `recommend()` + `whisper.recommend` IPC
**Dep:** T12 · **SB-R:** R7.1, R7.3
`os.totalmem` + `app.getGPUInfo` (best-effort, injected for tests); advisory
heuristic; falls back to `base`. **Verify:** unit tests over injected hardware
fixtures assert recommendations + fallback; never throws.

### T19 — `whisper/ModelManager.tsx` (table + downloaded/recommended + download/delete)
**Dep:** T18, T15 · **SB-R:** R7.1, R7.2
Catalog table (size/params/VRAM/speed), per-row downloaded + "Recomendado" badges,
download/delete with progress; opened from `IngestPanel`. **Verify:** tests: table
renders, recommended badge on the recommended row, download/delete updates state
(mocked bridge).

---

## Phase 7 — Quality

### T20 — Real-Electron E2E
**Dep:** T17 (+ T8) · **SB-R:** R8.1, R8.3
`e2e/second-brain.spec.ts` under xvfb: gate reaches work UI; switch to Second Brain
view (empty + fixture-vault); open FAB → paste text → assert `raw/*.md` on disk +
`/second-brain-ingest` turn launched over real IPC. Transcription stubbed (no
model/GPU in sandbox; decode + ingest paths carry the real assertions). **Verify:**
spec passes; `npm run verify` green (typecheck + 0 lint + full unit suite), no
regression vs the 1299 baseline; per-file coverage held on non-UI files.

### T21 — Playwright-MCP visual pass (dark + light) + impeccable polish
**Dep:** T20 · **SB-R:** R8.4, R8.5
Validate + polish every state via the window.hive-mock static-build recipe
([[hive-desktop-visual-validation]]): FAB + menu, IngestPanel (3 tabs), model
download progress, recorder states, SecondBrainPanel (empty + populated), model
manager — all first-party-beautiful in both themes. `noInlineStrings` green.
**Verify:** screenshots under `.playwright-mcp/second-brain-{dark,light}-*.png`;
any defects found are fixed.

### T22 — Closeout
**Dep:** T21 · **SB-R:** —
Mark tasks `[x]`; add ROADMAP.md **M12 — Second Brain** entry + STATE.md **D24**
(decisions/lessons); update the `hive-desktop-agent-change-review`-style memory with
a new `hive-desktop-second-brain` note. **Verify:** docs consistent; branch ready
to hand off/merge.

---

## Phase 8 — Ask + health cadence (post-M12 increment, 2026-07-27)

Two gaps M12 left open, both raised by the user: asking the base was a
question-less command, and the skill's own maintenance practice lived only in its
docs. Shipped together because both are the same idea — the app doing the
remembering.

### T23 [x] — Ask surface (`AskSecondBrain.tsx` + `askHistory.ts`)
**Dep:** T10 · **SB-R:** R9.1–R9.6
`secondBrainQuery(q)` → `/second-brain-query <q>`; DS Dialog with one field
(Enter asks, Shift+Enter breaks), openers → recents (`localStorage`, per
workspace), staged-material caveat, no-vault guard. Reached from
`Ctrl/Cmd+Shift+K`, the panel's primary CTA and the FAB menu's first item;
`Ctrl/Cmd+Shift+B` finally implements the rail's advertised shortcut.
**Verify:** `AskSecondBrain.test.ts` (9) + `askHistory.test.ts` (7) + the WorkUI
wiring tests; the transcript shows the question, the answer lands in the chat.

### T24 [x] — Health cadence ledger (`secondBrainHealth.ts` + IPC/preload)
**Dep:** T4 · **SB-R:** R10.1–R10.3, R10.6
Pure `deriveHealth(record, now)` ("10 ingests **or** 30 days with an ingest in the
window") over an atomic per-workspace JSON in `userData` — never in the
git-versioned vault. `getHealth`/`noteIngest`/`noteLint`/`snoozeHealth` each
return the fresh derivation. **Verify:** `secondBrainHealth.test.ts` (18),
including corrupt/hand-edited ledgers and an unwritable dir.

### T25 [x] — Health surfaces (`VaultHealthCard` + `HealthNudge` + rail dot)
**Dep:** T24 · **SB-R:** R10.1, R10.4, R10.5
Panel card (meter + count + last check + what's next; the ask when due), the
reminder in the FAB's stack, and a persistent accent dot on the activity-bar entry.
One recording point in `WorkUI.launchBrainAction` so no surface can drift.
**Verify:** `VaultHealthCard.test.ts` (8), `healthCopy.test.ts` (6), the WorkUI
suite's five M12 wiring tests.

### T26 [x] — Visual pass (dark + light) for both increments
**Dep:** T23, T25 · **SB-R:** R8.1, R8.4, R8.5
Playwright-MCP over the static build. Found and fixed: a duplicate "Revisar"
CTA (action row + healthy card), 3.9:1/3.5:1 secondary text on the accent-tinted
CTA in light theme, the ask guard reusing the *ingestion* copy, and health buttons
squeezing onto two lines in a narrow rail (now a container query + wrap).
**Verify:** `npm run verify` green — typecheck, 0 lint errors, **1569** tests
(baseline 1507); screenshots at `.playwright-mcp/sb2-{dark,light}-*.png`.

---

## Phase 9 — Bundled models + transcript review (M12.4, 2026-08-19)

Two user-reported gaps, both about the moment a person actually meets
transcription: the app asked for a download before it could hear anything, and
a transcript arrived as a finished thing rather than a draft.

### [x] T27 — The three models ship inside the app (SB-R7.5)

`tiny`, `base` and `small` are packaged in `resources/whisper-models/` as fp32
— the only precision that builds a session on the WASM backend — so a fresh
install transcribes with **no download at all**. The weights are fetched at
package time by `scripts/fetchWhisperModels.mjs` (wired into `build:win|mac|
linux`) and gitignored: ~1.3 GB of immutable, content-addressable ONNX belongs
in the installer, not in every clone.

`whisperModelStore` gained a `bundledDir`, a `bundled` flag on every catalog
row, and a `searchRoots()` the `hive-model:` protocol resolves through —
downloaded copy first, shipped copy second — so a user who fetches a model
anyway transparently shadows the bundled one, and deleting it reverts.
`remove()` never touches the installation.

**Verify:** real-Electron E2E fetches `hive-model://models/tiny/config.json`
out of `resources/` with a throwaway userData and gets the file; `modelStatus`
reports `{downloaded, fp32, bundled}`; unit tests cover the shadow/revert pair
and the no-fetch download short-circuit.

### [x] T28 — The model is chosen for the machine, not merely suggested (SB-R7.4)

The hardware recommendation had been advisory since M12: rendered as a badge,
acted on by nothing, so every machine transcribed with the same hardcoded
`base`. `whisper:preference` now resolves the model in main — the user's pin
when it is still usable, the probe's answer otherwise — and every transcribing
surface reads it. The ladder was retuned around what these weights actually do
(fp32 on one WASM thread) and gained core count; a property test asserts it can
**only ever** answer with a bundled model, so an automatic choice can never
imply a download.

The picker moved out of the manager dialog into a popover on a strip beside the
transcript: "Automático" is an option in the same list as the models, carrying
the reason the probe gave.

**Verify:** `isAutoSelectable` over the whole RAM×GPU×cores matrix; E2E asserts
`preference.auto` and a bundled id; the manager offers neither download nor
delete on a bundled row.

### [x] T29 — Upload stages, then transcribes on request (SB-R4.7)

Choosing a file used to start the pass immediately, which took two decisions
away from the user — which files actually go in, and which model runs — and
began minutes of CPU work nobody asked for. Files now land in a removable list
with the batch's total size, and one primary **Transcrever N áudios** starts
it. The per-file queue, progress and failure copy are `useAudioIngest` and
`AudioJobList`, unchanged.

**Verify:** component tests assert nothing decodes until the button is pressed,
that a duplicate drop is ignored, and that the transcript still lands in the
shared field and ingests identically.

### [x] T30 — Live dictation replaces the recorder (SB-R5.6)

"Gravar áudio" captured a take, stopped, and only then went looking for words.
"Ditar ao vivo" runs the microphone, the segmenter and the engine at once:
phrases are cut on silence and transcribed while the next one is spoken, each
landing in the transcript with the run it wrote marked. This is M13's
`useDictation`/`useComposerDictation` reused wholesale — the hook never
imported from `chat/`, so this was wiring, not a second implementation.
`AudioRecorder`, `Waveform` and `AudioFileTab` were deleted.

New DS component: **`HighlightedTextarea`** — the transparent-mirror technique
that was welded inside `PromptInput`, extracted so a field that is written into
while the microphone is open can tint what just arrived without giving up a
native textarea's caret, selection, IME or spellcheck. `RadioGroupItem` gained
`children` so a whole row can be the control.

**Verify:** component tests drive the E2E dictation seam and assert text
appears **mid-take**, that a second phrase appends, that Descartar rewinds the
draft, that dismissing the sheet releases the microphone, and that Ingerir is
blocked while a take is live.

### [x] T31 — Visual pass, dark + light

Playwright-MCP against the built renderer. Found and fixed, none of which a
test could have caught: the sheet had been **400 px since M12** (the app's
`520px` lost to a more specific DS selector, so labels wrapped and the model
strip stacked on its own caption); `.wb-doc` **collided with the file viewer's
existing class**, stretching the transcript's container to 574 px around a
151 px field; Radix's `RadioGroup.Indicator` mounts only when checked, so three
of four picker rows had no radio at all; the fresh-mark animation started
fading on frame one and was fully transparent before it could be read; and the
FAB menu still said "Colar texto"/"Áudio (arquivo)" while the tabs said
"Escrever"/"Enviar áudio" — one thing under two names.

**Verify:** `tools/visual/ingestContrast.mjs` (new; parses `oklch()` and
`oklab()`, composites every translucent layer) measures 34 targets across six
states in both themes — **34/34 PASS in each**, floor 4.5:1. Two real failures
were found and fixed: the drop zone's action link at 4.48:1 in dark, and the
"no aplicativo" badge at 4.12:1 in light, which produced a new DS role token,
`--success-tint-ink`, on the `--accent-tint-ink` precedent.

## Traceability (requirement → task)

| SB-R | Task(s) |
| --- | --- |
| R1.1 install-if-absent | T1, T3, T5 |
| R1.2 update-on-launch | T1, T3, T5 |
| R1.3 fail-soft gate | T3, T5 |
| R1.4 BMAD→second-brain order | T5 |
| R2.1 view swap | T6 |
| R2.2 empty→`/second-brain` | T7 |
| R2.3 wiki browser | T8 |
| R2.4 launch ingest/query/lint | T7 |
| R2.5 raw-pending badge | T4, T6 |
| R3.1 FAB + modes | T9 |
| R3.2 paste→raw+ingest | T4, T10 |
| R3.3 no-vault guard | T10 |
| R3.4 empty guard | T10 |
| R3.5 placement/a11y | T9, T21 |
| R4.1 local transcription | T2, T11, T13, T14 |
| R4.2 on-demand model + cache | T12, T14 |
| R4.3 editable transcript | T15 |
| R4.4 model selection (base) | T14, T15 |
| R4.5 transcript→ingest | T15 |
| R4.6 error handling | T13, T15 |
| R5.1 capture + permission | T16 |
| R5.2 convert + transcribe | T17 |
| R5.3 permission-denied UX | T16 |
| R5.4 re-record cleanup | T16 |
| R5.5 →ingest | T17 |
| R6.1 slash-menu discovery | (free — existing skill discovery; assert in T20) |
| R6.2 launch as turn | (free — existing workflow turn; assert in T20) |
| R7.1 recommendation | T18, T19 |
| R7.2 model manager | T12, T19 |
| R7.3 fallback to base | T18 |
| R8.1 no regression | T20 |
| R8.2 ≥90% coverage | T3, T4, T12, T13, T18 (+ all) |
| R8.3 E2E | T20 |
| R8.4 visual pass | T21 |
| R8.5 pt-BR | every UI task + T21, T26 |
| R9.1 ask reachable (shortcut/panel/FAB) | T23 |
| R9.2 question inside the command | T23 |
| R9.3 openers; empty never launches | T23 |
| R9.4 recent questions per workspace | T23 |
| R9.5 staged-but-unfiled caveat | T23 |
| R9.6 no-vault guard | T23 |
| R10.1 cadence shown | T24, T25 |
| R10.2 ingests recorded | T24, T25 |
| R10.3 check resets | T24, T25 |
| R10.4 ambient reminder + rail marker | T25 |
| R10.5 snooze | T24, T25 |
| R10.6 fresh/corrupt ledger | T24 |
| R4.7 stage, then transcribe on request | T29, T31 |
| R5.6 live dictation into the transcript | T30, T31 |
| R7.4 the model is chosen and applied | T28, T31 |
| R7.5 three models ship inside the app | T27, T31 |

**Coverage:** all 45 functional requirements map to tasks; R6.1/R6.2 are satisfied
by existing skill-discovery/workflow-turn machinery (asserted, not rebuilt). 26
tasks, 2 of them de-risking spikes (T1, T2) that must land findings in STATE.md
before their dependents; T23–T26 are the post-M12 ask + cadence increment.
