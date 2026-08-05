# Voice Prompt — Context & Locked Decisions

Gray areas resolved with the user on **2026-08-04**, before any requirement was
written. Every `D-VP-*` below is a user decision or a decision derived from one;
downstream documents cite them instead of re-litigating.

---

## Research that preceded the decisions

The feature was requested as "Windows Voice Typing when on Windows, Whisper
otherwise — validate whether that integration is possible". It was validated
first. Findings, with sources:

### Windows Voice Typing (`Win+H`) — possible, but only as a handoff

| Finding | Evidence |
| --- | --- |
| **No public API exists.** Nothing in the Windows SDK starts/stops voice typing or returns its transcript. The only programmatic trigger is synthesizing the `Win+H` keystroke (`SendInput`/`keybd_event` via P/Invoke) — impossible from plain Node, so it needs a native addon or a PowerShell `Add-Type` shim spawned through `ProcessRunner`. | Microsoft Learn: no `VoiceTyping` surface in any namespace; `SendInput` is the only documented input-synthesis path |
| **It requires internet and runs in the cloud.** | Microsoft support: *"To use voice typing, you'll need to be connected to the internet, have a working microphone, and have your cursor in a text box"* — powered by Azure Speech services |
| **It is a black box.** Text arrives as synthetic keystrokes into whatever control has focus. No start/stop events, no partial results, no confidence, no cancel, no error surface. | Behavioral — the panel is an OS-owned window, not an in-process component |
| **Language follows the OS input language** (`Win+Space`), not the app. | Microsoft support, "switch voice typing languages" |

### The two other Windows-adjacent paths are also closed

- **Web Speech API (`webkitSpeechRecognition`)** — Google disabled the Chrome
  Speech API for non-Chrome Chromium shells; it throws `network` in Electron and
  there is no key-injection escape hatch (electron#7749, electron#7758).
- **`Windows.Media.SpeechRecognition` (WinRT)** — its dictation constraint is a
  *web-service* grammar requiring "online speech recognition" enabled in
  Settings, caps at ~10 s of speech per recognition, and would still need a
  native addon.

### What already exists in this repo

M12 shipped a complete **offline Whisper stack** that this feature reuses whole:
`useWhisper` (`transcribe(pcm, {model, language})`), `decodeToWhisperPcm`,
`AudioRecorder`, `Waveform`, `whisperModelStore` + the privileged
`hive-model://` protocol, and a hardware-aware recommendation. Electron's
`setPermissionRequestHandler` already grants `media` (`src/main/index.ts:123`).

**Consequence:** this feature needs a *surface*, not an engine. It is expected to
be a **renderer + design-system change with zero new main-process code and zero
new IPC channels**.

⚠️ **Branch dependency:** the Whisper stack exists only on `feat/second-brain`,
never merged to `main`. `feat/voice-prompt` must branch from `feat/second-brain`.

---

## Locked decisions

### D-VP-1 — Whisper only. Windows Voice Typing is cut. *(user, 2026-08-04)*

One engine on every platform: the embedded, offline Whisper already in the app.
The `Win+H` handoff is **not built**.

**Why:** the validation above. It is cloud-dependent (contradicts D-SB-1's
offline posture and ships the squad's speech to Microsoft), un-instrumentable
(no waveform, no cancel, no error handling, no guaranteed pt-BR), and
focus-fragile. Shipping it as a second engine would double the surface area to
deliver a strictly worse experience.

**Consequence:** no native addon, no PowerShell shim, no `ProcessRunner` use, no
engine-selection setting to build or persist. Any future request for it starts
by re-reading this section.

### D-VP-2 — Streaming by pause, not one block at the end. *(user, 2026-08-04)*

While the user speaks, silence detection cuts the audio into segments; each
segment is transcribed in the background and its text lands in the composer
phrase by phrase, while capture continues uninterrupted.

**Why:** a chat prompt is a 5–20 s thought. Recording, then staring at a spinner
for the whole transcription, wastes the entire window in which the user is still
composing. Phrase-by-phrase arrival is what makes dictation feel like a mode of
the composer rather than a detour out of it.

**Consequence:** raw PCM capture via WebAudio (not `MediaRecorder`, whose
mid-stream chunks are not independently decodable), a pure segmenter, and a
serial transcription queue with in-order insertion. Verified against reality by
the T1 spike before anything is built on it (§ below).

### D-VP-3 — Chat composer first, built on a reusable hook + DS component. *(user, 2026-08-04)*

P1 ships dictation in the chat composer only. It is built as a Chat-agnostic
`useDictation` hook plus a presentational `DictationBar`, and the design system
gains the generic primitives it needs — so wiring "Perguntar à base", commit
messages or search later is a wiring job, not a refactor.

**Consequence:** no dictation code may import from `chat/`. A global
push-to-talk hotkey is explicitly deferred (the user chose this option *over*
the variant that included it).

### D-VP-4 — pt-BR fixed, no language selector. *(user, 2026-08-04)*

`language: 'portuguese'` always, inheriting D-SB-6. No picker, no
auto-detection.

**Why:** the squad works in pt-BR, and Whisper's auto-detection is unreliable on
the short utterances a chat prompt produces — it flips language mid-thought and
degrades more than it helps. Zero configuration beats a setting nobody changes.

---

## Derived decisions

### D-VP-5 — Capture starts before the engine is ready; audio is buffered.

Pressing the mic never waits on a download or a warm-up. Capture begins
immediately, segments queue, and the queue drains the moment the pipeline is
warm.

**Why:** it is the only honest answer to Whisper's cold start (a first-use model
download plus tens of seconds of WASM session build). The alternative — a
"preparing, please wait" gate — spends the user's thought on a progress bar.
Derived from D-VP-2: once a queue exists, buffering while cold is not a special
case, it is the queue being empty of consumers.

### D-VP-6 — The engine is pre-warmed on intent, not on app start.

`pointerenter`/`focus` on the mic button starts model readiness in the
background. Nothing is downloaded or loaded for users who never dictate.

### D-VP-7 — In-place mode change, never a modal.

Dictation transforms the composer where it already is: the toolbar's left
cluster crossfades into a transport row, the frame takes an accent ring, and the
textarea keeps its content, caret and position. No sheet, no dialog, no layout
shift.

**Why:** the second-brain ingest sheet already owns long-form audio capture.
Sending a user to a modal to speak one sentence into the field they are already
looking at is the detour D-VP-2 exists to remove. `product.md`'s "modal as first
thought is usually laziness" points the same way.

### D-VP-8 — Never show a guessed partial.

A segment still being transcribed is represented as a count ("2 trechos na
fila"), never as provisional words that later change. Text that appears in the
composer is final and editable.

### D-VP-9 — Discard restores the exact pre-dictation text.

`Esc` (or "Descartar") drops in-flight segments and rewinds the composer to the
value and caret it had before dictation started — a bad take never becomes
manual cleanup.

### D-VP-10 — Reuse the design system by extension, never by fork.

`PromptInput` gains two **generic** props (a toolbar overlay slot and a
highlighted/emphasis state); the level meter becomes a presentational
`LevelMeter` DS component that takes numbers and renders bars, leaving all
`MediaStream`/`AnalyserNode` handling in the app. No dictation vocabulary enters
the design system.

---

## Open questions the T1 spike must close before anything is built on them

Following the M12 precedent (both spikes corrected the design before code):

| ID | Question | Fallback if the answer is "no" |
| --- | --- | --- |
| **OQ1** | Does `new AudioContext({ sampleRate: 16000 })` really deliver a 16 kHz graph in the packaged Electron renderer, with a live mic source attached? | Capture at the hardware rate and resample per segment with `OfflineAudioContext` (the path `audio.ts` already proves). |
| **OQ2** | Does `audioWorklet.addModule()` load a same-origin worklet asset under this app's CSP from a `file://` origin? | `ScriptProcessorNode` — deprecated, main-thread, but universally available and sufficient for 16 kHz mono. |
| **OQ3** | What is the real round-trip for one ~5 s segment through `useWhisper` (`base`, fp32, WASM) on this machine? Is the real-time factor low enough for streaming to keep up with speech? | If RTF > ~1.5× on WASM: keep streaming on WebGPU, and on WASM fall back to a single end-of-take transcription — same UI, one segment. The bar's queue counter already communicates the difference honestly. |

`OQ3`'s answer is recorded as a measured number in STATE.md, not as an
impression.
