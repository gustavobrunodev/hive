# Voice Prompt — Design

Implements `spec.md` (VP-R1…R7) under the decisions in `context.md` (D-VP-1…10).

---

## 1. Shape of the change

**Renderer + design system only. Zero main-process code, zero new IPC.**

Everything the engine needs already exists and already crosses the bridge:
`window.hive.whisper.{modelStatus,downloadModel,recommend}`, the `hive-model://`
protocol, and Electron's `media` permission grant
([index.ts:123](../../../src/main/index.ts)). This feature adds a *mouth* to a
stack that already has ears.

```
┌─ design-system ───────────────────────────────────────────────┐
│  LevelMeter        (new — presentational, numbers → bars)      │
│  PromptInput       (extended — toolbarOverlay?, highlighted?)  │
└───────────────────────────────────────────────────────────────┘
┌─ renderer/src/dictation/ (new) ───────────────────────────────┐
│  segmenter.ts      pure   silence → segment boundaries         │
│  transcriptJoin.ts pure   segment text → composer value/caret  │
│  dictationCopy.ts  pure   phase → i18n key                     │
│  micCapture.ts     thin   getUserMedia → 16 kHz Float32 frames │
│  useDictation.ts   hook   state machine + serial queue          │
│  DictationBar.tsx  view   presentational transport              │
└───────────────────────────────────────────────────────────────┘
                        │ consumes
                        ▼
      secondBrain/whisper/useWhisper.ts   (unchanged, reused)
```

`useWhisper` is reused **as-is**: `transcribe(pcm, { language: 'portuguese' })`
already downloads-then-warms-then-caches the pipeline per model+variant, so the
second segment costs nothing. No change to it is planned; if one proves
unavoidable it must stay additive (the second brain depends on it).

---

## 2. Module responsibilities

### `segmenter.ts` — pure (the coverage heart)

A state machine fed one *tick* at a time. A tick is `{ rms, samples }` produced
by `micCapture` at a fixed cadence (~32 ms). It never touches WebAudio, never
allocates a `MediaStream`, and is exhaustively testable from synthetic level
arrays.

```ts
export interface SegmenterConfig {
  /** Speech is anything above the measured noise floor by this margin. */
  rmsMargin: number
  /** Continuous silence that closes a segment. */
  silenceHoldMs: number      // 700
  /** Below this much *speech*, a pause does not cut (breath ≠ boundary). */
  minSpeechMs: number        // 1200
  /** Hard ceiling for one segment. */
  maxSegmentMs: number       // 15000
  /** Audio kept from before onset, so the first phoneme survives. */
  preRollMs: number          // 300
  /** Audio kept after the cut, so the last consonant survives. */
  tailPadMs: number          // 200
  /** Silence after which the UI says "não estou ouvindo nada". */
  silenceNoticeMs: number    // 3000
  /** Silence after which dictation finalizes itself. */
  autoStopMs: number         // 8000
}

export type SegmenterEvent =
  | { type: 'speech' }
  | { type: 'segment'; index: number; pcm: Float32Array; ms: number }
  | { type: 'notice'; silentMs: number }
  | { type: 'autostop' }

export function createSegmenter(cfg: SegmenterConfig): {
  push(tick: Tick): SegmenterEvent[]
  /** Closes whatever is open — used by Concluir. */
  flush(): SegmenterEvent[]
}
```

**Noise floor.** Fixed thresholds fail on real hardware (a laptop fan, an open
office). The first `~500 ms` of ticks calibrate a floor as the median RMS;
speech is `floor + rmsMargin`. The floor keeps adapting downward during silence
so a room that quiets down doesn't leave the gate stuck open.

**Pre-roll** is a ring buffer of the last `preRollMs` of ticks, always retained
even while classified as silence. Without it every segment starts clipped, which
Whisper renders as a dropped first word — the defect is silent and constant.

**Why `minSpeechMs`.** VP-R2.6. A 700 ms pause is common *inside* a sentence
("então… a gente precisa"). Cutting there yields two fragments Whisper
transcribes without shared context, which reads worse than one segment.

### `transcriptJoin.ts` — pure

```ts
export function joinTranscript(
  value: string, selectionStart: number, selectionEnd: number, text: string
): { value: string; caret: number; range: [number, number] }
```

Rules (VP-R2.2), each a test case:

| Left context | Incoming | Result |
| --- | --- | --- |
| `""` | `olá` | `Olá` — first word of an empty composer is capitalized |
| `revisa o ` (trailing space) | `arquivo` | `revisa o arquivo` — no doubled space |
| `revisa o` (no space) | `arquivo` | `revisa o arquivo` — space inserted |
| `feito.` | `agora vai` | `feito. Agora vai` — capital after `.`/`!`/`?` |
| `lista` | `, e mais` | `lista, e mais` — never a space before punctuation |
| selection `abc` selected | `xyz` | selection replaced (first segment only) |

`range` is the inserted run, used for the landing mark (VP-R2.3) and discarded
after. Nothing here knows what a textarea is.

### `micCapture.ts` — thin, injectable

```ts
export interface CaptureDeps {
  getUserMedia(c: MediaStreamConstraints): Promise<MediaStream>
  createContext(sampleRate: number): AudioContext
}
export interface Capture {
  onTick(fn: (t: Tick) => void): void
  /** Live 0–1 levels for the meter, sampled from the AnalyserNode. */
  onLevels(fn: (levels: number[]) => void): void
  stop(): void
}
export type CaptureError = 'denied' | 'unavailable'
```

Graph: `getUserMedia({ audio: { channelCount: 1, echoCancellation: true,
noiseSuppression: true, autoGainControl: true } })` →
`AudioContext({ sampleRate: 16000 })` → source → { `AnalyserNode` (meter,
`fftSize: 256`), worklet/processor (frames) }.

**Requesting 16 kHz at the `AudioContext` removes the resample step entirely** —
the browser does it correctly, and `audio.ts`'s `OfflineAudioContext` path stays
the fallback. `MediaRecorder` is deliberately not used: a mid-stream WebM chunk
carries no container header and is not independently decodable, which is exactly
what streaming needs. **Both of these assumptions are OQ1/OQ2 and are settled by
the T1 spike before anything is built on them.**

The two teardown-critical facts, both learned by `AudioRecorder` already:
`stop()` must stop **every** track (a surviving track keeps the OS microphone
indicator lit) and must also `close()` the `AudioContext`.

### `useDictation.ts` — the orchestrator

```ts
export type DictationPhase =
  | { status: 'idle' }
  | { status: 'listening'; seconds: number; silentMs: number; pending: number }
  | { status: 'preparing'; seconds: number; pending: number; engine: WhisperPhase }
  | { status: 'finalizing'; pending: number }
  | { status: 'error'; kind: CaptureError | 'engine'; message?: string }

export interface DictationTarget {
  /** Current value + selection of the field being dictated into. */
  read(): { value: string; selectionStart: number; selectionEnd: number }
  /** Applies a join result; the field owns focus/caret restoration. */
  write(next: { value: string; caret: number; range: [number, number] }): void
}
```

The hook takes a `DictationTarget` — that indirection is the whole of VP-R5.1.
Chat supplies one backed by its `composerValue` state and `composerTextareaRef`;
any other field supplies its own. **The hook never imports from `chat/`.**

**Serial transcription queue.** One `transcribe()` in flight at a time — the
pipeline is not reentrant and concurrent WASM sessions thrash. Each item carries
its `index`; a reorder buffer releases results only when every lower index has
been written (VP-R2.4). Because the queue drains only when the pipeline is warm,
**VP-R3's buffering is not a special case** — it is the queue with no consumer
yet (D-VP-5).

**Pre-warm** (VP-R3.4, D-VP-6): `prewarm()` is exposed for the mic control's
`pointerenter`/`focus` and just calls `useWhisper`'s existing readiness path with
an empty guard. Nothing runs at app start.

**Failure containment** (VP-R4.4): a failed segment keeps its `pcm` in the queue
item, so `retry()` re-enqueues the same audio. The queue continues past a
failure; the take is never lost silently.

### `DictationBar.tsx` — presentational

Props are the phase plus four callbacks (`onFinish`, `onDiscard`, `onRetry`,
`onRequestMic`). No hooks beyond layout, no media, no engine (VP-R5.2).

### `dictationCopy.ts` — pure

Phase → i18n key, following the established `audioJobCopy.ts` / `healthCopy.ts` /
`enginePhase.ts` pattern. Keeps the branching out of JSX and under test.

---

## 3. The interface

### Scene sentence

> A senior dev mid-afternoon, window light on the desk, the Hive filling the
> screen, hands off the keyboard, thinking out loud about what they want the
> agent to do — eyes on the composer, needing to see that the app is listening
> and to trust that nothing said is being lost.

That sentence forces the design: **in the composer, not a modal**; legible in
both themes because the app already ships a theme picker; and continuously
proving it is alive, because a lost thought is the expensive failure.

### Color strategy — Restrained

The product default, held. Dictation state is carried by three quiet signals,
not by painting the composer:

- the composer frame ring shifts `--border` → `--accent`
- a pulsing record dot at `--accent`
- the live level meter, `--accent` bars over `--surface-2`

Everything else stays in the neutral ramp. **The send control remains the only
accent-*filled* element in the row** (VP-R6.4) — `Concluir` and `Descartar` are
ghost buttons. Two accent-filled buttons fighting in one 32 px row is the exact
"strangeness without purpose" `product.md` warns about.

Anchors: **Wispr Flow** (text materializing in the field you are already in),
**Raycast** (a quiet affordance that briefly becomes the surface's protagonist,
then disappears), **iOS Voice Memos** (a bar meter that reads as honest signal,
not decoration).

### Anatomy

```
┌─ PromptInput ────────────────────────── ring: --accent while dictating ─┐
│ [ attachment chips … ]                                                   │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ revisa o arquivo de configuração⎸        ← caret; fresh run marked  │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│ ┌ toolbar row (same height, no shift) ──────────────────────────────┐   │
│ │ ◉ 0:07  ▁▃▅▂▇▃▁▂  Ouvindo… · 2 trechos      Descartar  Concluir │▲│  │
│ └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
        └─ toolbarOverlay replaces { attach · agent · model · effort }
                                                    send stays put ─┘
```

Idle, the row is the toolbar the app already has, plus a mic `IconButton`
leading the paperclip — muted ink, no fill, no badge (VP-R1.1).

### States

| State | What the user sees | Why |
| --- | --- | --- |
| `idle` | Quiet mic icon in the toolbar | Dictation is an alternative to typing, not a campaign |
| `preparing` | `◉ 0:03` · live meter · **"Pode falar — estou guardando seu áudio"** + real % | D-VP-5. The promise is explicit because the user cannot see the buffer |
| `listening` | `◉ 0:07` · live meter · "Ouvindo…" | Proof of life |
| `listening` + pending | …· "Ouvindo… · 2 trechos" | VP-R2.5 — a count, never guessed words |
| `silent` | Flat meter · "Não estou ouvindo nada" | VP-R4.1 — the timer alone lies |
| `autostop` | "Encerrando em 3…" with the countdown | VP-R4.2 — never stop without warning |
| `finalizing` | Meter gone · "Transcrevendo 2 trechos…" · send disabled | VP-R1.4 |
| `denied` / `unavailable` | Inline row, distinct copy, **Tentar de novo** | VP-R4.3 — the draft is untouched |
| `error` | `--danger-bg` row · "Seu áudio está guardado" · **Tentar de novo** | VP-R4.4 — a failure that loses the take is unforgivable |

### Motion (150–250 ms, project easing tokens)

| Moment | Motion | Reduced-motion |
| --- | --- | --- |
| Enter dictation | toolbar cluster fades out 120 ms; transport fades in + 8 px slide, 180 ms `--ease-expo`; ring `--border`→`--accent` 200 ms | crossfade only, no slide |
| Live meter | driven by real analyser data — **no keyframes** | unchanged (it is data, not animation) |
| Record dot | 1.6 s opacity pulse (reuses `.wb-brain-recorder-dot`) | static dot at full opacity |
| Segment lands | inserted run flashes `--selected-bg`, fades out 600 ms | mark applied and removed with no transition |
| Exit | reverse of enter, 160 ms | crossfade |

No layout properties are animated (VP-R6.1). The `reducedMotion.test.ts` sensor
already exists and gains the new selectors.

### Accessibility

- Transport is `role="status"` `aria-live="polite"`; phase changes announce
  through `dictationCopy` (VP-R4.5).
- Elapsed time is `role="timer"` with `aria-label` (the `AudioRecorder` pattern).
- Mic control carries `aria-pressed`.
- `Esc` discards; `Tab` order is mic → transport buttons → send.
- Every colour pair validated with `ui/contrast.ts` in **both** themes; the
  accent ring and meter bars are meaningful non-text indicators and must clear
  3:1 against their own background — the light theme's `--accent`
  (`--bordo-sensatez`) over `--surface` is the pair most likely to fail and is
  checked first.

---

## 4. Design-system changes (D-VP-10)

### New: `LevelMeter`

```tsx
<LevelMeter levels={number[]} bars={20} label={string} />
```

Presentational. Takes normalized `0–1` levels, renders bars; when every level is
~0 it renders the flat "no signal" line. Zero media knowledge — the app owns the
`AnalyserNode`. Reusable by any future recorder surface.

### Extended: `PromptInput` — two generic props

```ts
/** Replaces the toolbar's extra-controls slot and spans the row.
 *  The send control keeps its position and behaviour. */
toolbarOverlay?: ReactNode
/** Emphasis state for the composer frame (accent ring). */
highlighted?: boolean
```

Both are generic by name and behaviour — no dictation vocabulary enters the
design system — and both are additive with defaults, so every existing usage and
`PromptInput.test.tsx` passes untouched (VP-R5.4).

> `design-system/dist` is versioned and consumed through a `node_modules`
> symlink: **rebuild the design system after any change**, and never run
> `npx prettier` inside `design-system/` (no config there; its style is
> semicolon-free — see the project's design-system conventions).

### Backdrop composition

Chat's `highlightComposer` today renders mention tokens through `PromptInput`'s
`highlight` backdrop. The freshly-inserted run reuses that same mechanism: a pure
`composerBackdrop(value, fileSet, freshRange)` emits segments carrying both flags.
The contract is unforgiving and already documented on the prop — **the returned
nodes must preserve the value's exact character sequence** or the backdrop
misaligns — so it is unit-tested character-for-character.

---

## 5. Test strategy (VP-R7.2)

| Module | How it is tested | Target |
| --- | --- | --- |
| `segmenter.ts` | Synthetic tick arrays: onset, breath-pause, real pause, max-length cut, noise-floor drift, notice, autostop, pre-roll/tail | 100% |
| `transcriptJoin.ts` | The table in §2, plus selection replacement and unicode/accent boundaries | 100% |
| `dictationCopy.ts` | Every phase → key | 100% |
| `micCapture.ts` | Injected `CaptureDeps` fakes; asserts track+context teardown on every exit path | ≥90% |
| `useDictation.ts` | `renderHook` with a fake capture + fake transcriber: ordering, out-of-order resolution, cold-start buffering, discard-restores-draft, failure retry, unmount teardown | ≥90% |
| `DictationBar.tsx` | RTL render per state; a11y roles; callback wiring | UI |
| `LevelMeter` | DS test: bars, flat line, label | ≥90% |
| `PromptInput` | Existing file **unchanged** + new cases for the two props | ≥90% |
| E2E | Real Electron, engine faked at the seam (`e2eAgentSeam.ts` pattern) | VP-R7.3 |

New file globs go into `vitest.config.ts` — an unlisted file is not measured
(AGENTS.md).

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| **Streaming is slower than speech on WASM** (the premise of D-VP-2) | **OQ3**, measured by the T1 spike before any UI exists. Defined fallback: streaming on WebGPU, single end-of-take segment on WASM — same UI, one segment, no redesign. |
| `AudioWorklet` blocked by CSP from `file://` | **OQ2**; `ScriptProcessorNode` fallback, deprecated but sufficient at 16 kHz mono. The M12 T2 spike proved this class of assumption is where this app breaks. |
| `AudioContext({ sampleRate: 16000 })` ignored | **OQ1**; fall back to `OfflineAudioContext` resampling per segment, the path `audio.ts` already proves. |
| Cold start still feels slow despite buffering | Pre-warm on intent (D-VP-6) + honest progress copy. The audio is never lost, which is the property that matters. |
| Segment boundaries fragment sentences | `minSpeechMs` + pre-roll + tail pad, each an explicit AC and an explicit test. |
| Backdrop drift misaligns the mention highlight | Character-exact unit test on `composerBackdrop`; the risk is called out on the prop itself. |
| `Chat.tsx` is 54 kB and lint enforces `complexity: 15` / `max-lines-per-function: 150` | The composer already nests `renderToolbar`/`renderComposer` for exactly this reason. Dictation adds **one** hook call, **one** target object and **one** JSX slot — everything else lives in `dictation/`. |

---

## 7. Traceability

| Requirement | Where it is implemented |
| --- | --- |
| VP-R1.1–1.3, 1.7 | `Chat.renderToolbar` (mic), `useDictation`, `DictationBar`, `PromptInput.toolbarOverlay/highlighted` |
| VP-R1.4–1.6 | `useDictation.finish/discard`, Chat submit interception |
| VP-R2.1, 2.6–2.8 | `segmenter.ts` |
| VP-R2.2–2.3 | `transcriptJoin.ts`, `composerBackdrop` |
| VP-R2.4–2.5 | `useDictation` reorder buffer + `pending` |
| VP-R3.1–3.3, 3.5 | `useDictation` queue (cold = no consumer) |
| VP-R3.4 | `useDictation.prewarm` + mic control handlers |
| VP-R4.1–4.2 | `segmenter` notice/autostop → `DictationBar` |
| VP-R4.3–4.4 | `micCapture` error kinds, queue item retention, `retry()` |
| VP-R4.5 | `DictationBar` roles + `dictationCopy` |
| VP-R4.6 | `micCapture.stop()` + `useDictation` cleanup effect |
| VP-R5.1–5.5 | module layout, `DictationTarget`, `LevelMeter`, `PromptInput` props, pure modules |
| VP-R6.1–6.5 | `workbench.css` dictation block, `reducedMotion.test.ts`, `contrast.spec.ts`, `i18n/pt-BR.ts` |
| VP-R7.1–7.5 | `tasks.md` closing phase |
