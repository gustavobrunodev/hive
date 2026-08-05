# Tasks — Voice Prompt

**Design:** `design.md` · **Spec:** `spec.md` · **Context:** `context.md`
**Status:** 🚧 In progress (2026-08-04) — T1 done. Branch `feat/voice-prompt`, **off
`feat/second-brain`** — the Whisper stack it consumes exists only there, never
merged to `main`. ROADMAP **M13**; STATE **D26**.

Atomic, ordered by dependency. Each task = one focused change + its tests + one
atomic commit. Verification is concrete (a command or an observable). `[P]` = can
run in parallel with siblings once its deps are met.

Prereq every task: `source ~/.nvm/nvm.sh && nvm use 22.22.1` (nvm does not
persist across tool calls — STATE lesson). A fresh worktree also needs
`@hive/design-system` built first.

**Conventions:** UI tasks use the `impeccable` skill (product register) + DS role
tokens; the visual task uses the **Playwright MCP** in dark **and** light
(`docs/visual-validation.md`). Free to extend/create DS components (D-VP-10) —
but **never run `npx prettier` inside `design-system/`**, and **rebuild
`design-system/dist` after any change to it** (versioned, consumed via a
`node_modules` symlink). Every string via `t()` (pt-BR) — `noInlineStrings` is
part of every UI task's verify. Non-UI files hold **≥90% per-file coverage**;
add each new file's glob to `vitest.config.ts` or it is not measured.

Legend: **Dep** = task ids that must land first. **VP-R** = requirement(s).
**Verify** = pass condition.

---

## Execution plan

| Batch | Phase | Tasks | Why it is one unit |
| --- | --- | --- | --- |
| **A** | P0 Spike + P1 Pure core + P2 Engine | T1–T7 | Nothing renders until the audio→text path is proven and tested headlessly |
| **B** | P3 Design system + P4 Surface | T8–T13 | The DS primitives and the composer that consumes them ship together |
| **C** | P5 Closing | T14–T17 | Gates, E2E, visual pass, docs |

A batch never starts before the previous one reports every task committed.
Batch A's **T1 gates everything** — its findings can change T5 and T7.

---

## P0 — Spike

### T1 [x] — Spike: prove the capture path and measure streaming latency

**Dep:** — · **VP-R:** VP-R2 (premise), VP-R3 · **[no production code]**

Run in the **real Electron renderer**, not jsdom. Close the three open questions
from `context.md`:

- **OQ1** — does `new AudioContext({ sampleRate: 16000 })` deliver a 16 kHz graph
  with a live `getUserMedia` source attached? Log `context.sampleRate` and the
  frame rate actually observed.
- **OQ2** — does `audioWorklet.addModule()` load a same-origin worklet asset under
  this app's CSP from a `file://` origin? If it throws, confirm
  `ScriptProcessorNode` produces frames.
- **OQ3** — feed one ~5 s segment through the existing `useWhisper` (`base`,
  fp32, WASM) and **measure** wall-clock transcription time. Compute the
  real-time factor. Repeat on WebGPU if an adapter answers.

**Verify:** three answers written into `.specs/project/STATE.md` as a dated
`Lessons (voice-prompt — T1 spike)` section, **with the measured numbers**, and
`design.md` §6 updated if any fallback is now the chosen path. If OQ3's RTF on
WASM exceeds ~1.5×, record the fallback decision (streaming on WebGPU,
single end-of-take segment on WASM) **before** T7 is written.

> This is the M12 precedent: both of its spikes corrected the design before code
> was built on it. Assumptions about the Electron media/CSP stack are exactly
> where this app has broken before.

---

## P1 — Pure core

### T2 [P] — `segmenter.ts`: silence → segment boundaries

**Dep:** T1 · **VP-R:** VP-R2.1, VP-R2.6–2.8, VP-R4.1–4.2

Pure state machine per `design.md` §2: adaptive noise floor, `silenceHoldMs`,
`minSpeechMs`, `maxSegmentMs`, pre-roll ring buffer, tail pad, notice and
autostop events. No WebAudio, no DOM.

**Verify:** `npm run test -- segmenter` green with cases for onset, breath-pause
(**no** cut), real pause (cut), max-length forced cut, noise-floor drift, silence
notice, autostop, and pre-roll/tail-pad inclusion in the emitted PCM. **100%**
statements/branches/functions/lines; glob added to `vitest.config.ts`.

### T3 [P] — `transcriptJoin.ts`: segment text → composer value + caret

**Dep:** T1 · **VP-R:** VP-R2.2

Pure `joinTranscript(value, selectionStart, selectionEnd, text)` returning
`{ value, caret, range }`, implementing the join table in `design.md` §2.

**Verify:** `npm run test -- transcriptJoin` green with one case per table row,
plus selection-replacement, accented/multi-byte boundaries, and an empty
incoming segment (no-op, caret unmoved). **100%** coverage; glob added.

### T4 [P] — `dictationCopy.ts` + pt-BR strings

**Dep:** T1 · **VP-R:** VP-R4.5, VP-R6.5

Phase → i18n key mapping (the `audioJobCopy.ts` / `healthCopy.ts` pattern) and
every `dictation.*` key in `i18n/pt-BR.ts`: `start`, `listening`, `preparing`,
`preparingKeep`, `transcribing`, `queue`, `silent`, `autoStop`, `finish`,
`discard`, `denied`, `unavailable`, `retry`, `error`, `errorKeep`, `elapsed`,
`finishAndSend`.

**Verify:** `npm run test -- dictationCopy` green with every phase mapped and no
key missing from `pt-BR.ts`; **100%** coverage; glob added.

---

## P2 — Capture + engine

### T5 — `micCapture.ts`: mic → 16 kHz Float32 frames + levels

**Dep:** T1, T2 · **VP-R:** VP-R4.3, VP-R4.6

Implements the graph T1 chose. Injectable `CaptureDeps`. Distinguishes `denied`
from `unavailable` (`getUserMedia`'s `NotFoundError`/`DevicesNotFoundError` →
`unavailable`, per `AudioRecorder`'s existing rule).

**Verify:** `npm run test -- micCapture` green with injected fakes; asserts
`stop()` stops **every** track **and** closes the `AudioContext` on all exit
paths (normal stop, error during start, double-stop). ≥90% coverage; glob added.

### T6 — `useDictation.ts`: lifecycle, phases, finalize, discard

**Dep:** T5, T3 · **VP-R:** VP-R1.2, VP-R1.4–1.5, VP-R4.1–4.3, VP-R4.6, VP-R5.1

The hook's audio half: `DictationTarget` indirection, phase machine, elapsed
timer, silence notice, autostop, `finish()`, `discard()` restoring the exact
pre-dictation value **and caret**, and full teardown on unmount.

**Verify:** `npm run test -- useDictation` green via `renderHook` with a fake
capture: start→listening, silence→notice→autostop, discard restores the draft
byte-for-byte, unmount stops tracks. `moduleBoundaries.test.ts` green (no import
from `chat/` or `src/main`). ≥90% coverage; glob added.

### T7 — Transcription queue: serial, in-order, cold-start buffering, retry

**Dep:** T6 · **VP-R:** VP-R2.3–2.5, VP-R3.1–3.5, VP-R4.4

The hook's text half: one `transcribe()` in flight, per-segment `index`, reorder
buffer releasing only when every lower index is written, `pending` count,
`prewarm()`, and `retry()` re-enqueuing the retained `pcm`. Consumes `useWhisper`
unchanged with `language: 'portuguese'` (D-VP-4). Honours T1's OQ3 decision.

**Verify:** `npm run test -- useDictation` green with a fake transcriber for:
out-of-order resolution still inserts in spoken order; segments captured while
the engine is cold are all inserted once it warms; `pending` reflects the queue;
a failing segment leaves the queue running and `retry()` reuses the same audio;
`prewarm()` runs nothing at mount. ≥90% coverage.

---

## P3 — Design system

### T8 — DS: `LevelMeter`

**Dep:** T1 · **VP-R:** VP-R5.3, VP-R6.2

Presentational `LevelMeter({ levels, bars, label })` — numbers in, bars out, flat
line when signal is ~0. No media knowledge. Component + CSS + story + test.

**Verify:** `design-system` test green; the story renders in Storybook; **`dist`
rebuilt and committed**; `npx prettier` **not** run in `design-system/`.

### T9 — DS: `PromptInput` gains `toolbarOverlay` + `highlighted`

**Dep:** T8 (serialized: both rebuild the same `dist`) · **VP-R:** VP-R5.4, VP-R1.2

Two generic, additive props per `design.md` §4. `toolbarOverlay` replaces the
toolbar-extra slot and spans the row; the send control keeps its position and
behaviour. `highlighted` applies the accent ring.

**Verify:** **`PromptInput.test.tsx` passes unchanged** (backward compatibility is
the point), plus new cases: overlay replaces `toolbar`, send still submits with
an overlay mounted, `highlighted` sets the frame state. `dist` rebuilt and
committed.

---

## P4 — Surface

### T10 — `DictationBar.tsx` + CSS

**Dep:** T7, T8 · **VP-R:** VP-R1.3, VP-R4.1–4.5, VP-R5.2, VP-R6.4

Presentational transport: record dot + elapsed, `LevelMeter`, status line,
Descartar / Concluir. Every state in `design.md` §3. `role="status"`
`aria-live="polite"`, `role="timer"`, ghost buttons only — **the send control
stays the row's only accent-filled element**.

**Verify:** RTL render per state (listening, preparing, pending, silent,
autostop, finalizing, denied, unavailable, error); a11y roles asserted;
`noInlineStrings` green.

### T11 — `composerBackdrop`: mentions + freshly-inserted run

**Dep:** T3 · **VP-R:** VP-R2.3

Pure composition of the existing mention segmentation with the fresh-insert
range, feeding `PromptInput`'s `highlight` backdrop.

**Verify:** `npm run test -- composerBackdrop` green, including a
**character-for-character** assertion that the rendered segments reproduce the
input value exactly (drift misaligns the backdrop — the prop's own contract).
**100%** coverage; glob added.

### T12 — Wire dictation into the chat composer

**Dep:** T9, T10, T11 · **VP-R:** VP-R1.1, VP-R1.2, VP-R1.4–1.7, VP-R3.4

Mic `IconButton` leading the paperclip in `renderToolbar`; `DictationTarget`
backed by `composerValue` + `composerTextareaRef`; `toolbarOverlay`/`highlighted`
driven by phase; `Esc` discards; submit finalizes-then-sends; `prewarm` on
`pointerenter`/`focus`. Composer-scoped toggle shortcut — **check the shortcut
catalog for a collision before choosing the binding** (VP-R1.7).

**Verify:** `npm run test -- Chat` green with new cases: mic starts dictation,
inserted text lands at the caret, Esc restores the draft, submit-during-dictation
finalizes first. `npm run lint` green — `Chat.tsx` must stay under
`complexity: 15` / `max-lines-per-function: 150`. `noInlineStrings` green.

### T13 — Motion, reduced motion, theme polish (`impeccable`)

**Dep:** T12 · **VP-R:** VP-R6.1–6.4

The motion table in `design.md` §3: enter/exit crossfade + slide on
`--ease-expo`, record pulse, segment-landing flash, no animated layout
properties. A `prefers-reduced-motion` alternative for each.

**Verify:** `reducedMotion.test.ts` extended and green over the new selectors; no
animated layout property in the dictation CSS block; both themes eyeballed
before T16 runs for real.

---

## P5 — Closing

### T14 — Coverage globs + `npm run verify` green

**Dep:** T13 · **VP-R:** VP-R7.1–7.2

Every new non-UI file's glob in `vitest.config.ts`; full gate run.

**Verify:** `npm run verify` green — typecheck (node + web), **0 lint errors**,
full suite with **no regression** against the 1570 baseline. `npm run
test:coverage` shows every changed non-UI file ≥90%; **the inherited 14-file
failing list has not grown**.

### T15 — Real-Electron E2E

**Dep:** T14 · **VP-R:** VP-R7.3

`e2e/voice-prompt.spec.ts`: engine and capture faked at a seam (the
`e2eAgentSeam.ts` pattern), covering enter → segment lands → finalize, and
Esc → draft restored.

**Verify:** `npm run build && xvfb-run -a npm run test:e2e:app` — the new spec
passes alongside `app-launch`. The spec **must strip `ELECTRON_RUN_AS_NODE`**
from the env passed to `_electron.launch` (WSL interop leak, AGENTS.md). Any
pre-existing failure is confirmed pre-existing against the branch base in a clean
worktree before being called unrelated.

### T16 — Playwright-MCP visual pass, dark + light

**Dep:** T15 · **VP-R:** VP-R6.2–6.3, VP-R7.4

Every state in `design.md` §3 screenshotted in **both** themes per
`docs/visual-validation.md`; contrast measured with `ui/contrast.ts` — starting
with light-theme `--accent` (`--bordo-sensatez`) over `--surface`, the pair most
likely to fail. Fix what the pass finds, in this task.

**Verify:** screenshots under `.playwright-mcp/voice-prompt-{dark,light}-*.png`;
`contrast.spec.ts` extended over the transport and green; every defect found is
either fixed here or logged in STATE.md with a reason.

### T17 — Close out: ROADMAP, STATE, spec status

**Dep:** T16 · **VP-R:** VP-R7.1–7.5

ROADMAP **M13 — Voice Prompt** with exit criteria and the met/not-met verdict;
STATE **D26** recording D-VP-1 (and *why* Windows Voice Typing was cut, so the
next session does not re-propose it) plus the T1 measurements; `tasks.md` status
line updated; `HARNESS.md` updated **only if** a control changed.

**Verify:** the three docs reflect what actually shipped, including deviations
and anything deferred.

---

## Deferred (P2, not in this milestone)

- Global push-to-talk hotkey (the user chose the reusable-hook scope over it).
- Dictation in "Perguntar à base", commit message, and search — wiring only,
  the hook and transport are built for it (VP-R5).
- Insert-position control (dictate into the middle of an existing draft with a
  visible anchor) — today it follows the caret.
