# Voice Prompt Specification

## Problem Statement

The chat composer is the only way into the Hive. Everything a user wants from an
agent — a task, a correction, a half-formed idea — has to be typed there first,
and typing is the narrowest part of the pipe: it is slower than thinking, it
punishes long context ("explain the whole situation first"), and it stops
entirely when the user's hands are elsewhere.

The app already transcribes speech offline — M12 shipped an embedded Whisper for
the second brain — but that capability is locked inside an ingestion sheet aimed
at archiving long-form material into a vault. There is no way to simply **speak a
prompt**.

This feature makes voice a first-class way to compose: press once, talk, and
watch the words land in the composer while you are still talking — offline, in
pt-BR, without leaving the field you were already looking at.

## Goals

- [ ] Let a user **dictate a prompt directly into the chat composer**, in place,
      without a modal and without losing what was already typed.
- [ ] Make the text arrive **while the user is still speaking** — silence cuts a
      segment, the segment is transcribed in the background, the words land at
      the caret (D-VP-2).
- [ ] Never make the user wait on infrastructure: capture starts **immediately**,
      even on first use with no model on disk, and the audio is buffered until
      the engine is warm (D-VP-5).
- [ ] Stay **fully offline** — one engine, the embedded Whisper already in the
      app; nothing spoken leaves the machine (D-VP-1).
- [ ] Tell the truth in every state: listening, silent, preparing, queued,
      failed — and **never show a guessed word** (D-VP-8).
- [ ] Build it as a **reusable hook + design-system primitives**, so the next
      text field to gain dictation is a wiring change (D-VP-3, D-VP-10).
- [ ] Deliver a surface shaped with `impeccable`, validated in the Playwright MCP
      in **both themes**, fully pt-BR via `t()`.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| **Windows Voice Typing (`Win+H`) / any OS dictation handoff** | Validated and cut (**D-VP-1**). No public API, cloud-only (Azure), un-instrumentable, focus-fragile, no guaranteed pt-BR. Full evidence in context.md — a future request starts there. |
| Web Speech API, Azure/Google/OpenAI STT, any cloud transcription | Same decision. `webkitSpeechRecognition` is additionally dead in Electron (electron#7758). |
| A language selector or auto-detection | **D-VP-4**: pt-BR fixed. Auto-detection flips language mid-thought on short utterances. |
| A **global** push-to-talk hotkey | Deferred to P2 — the user chose the reusable-hook scope *over* the variant that included it (D-VP-3). A composer-scoped shortcut is in scope; a system-wide one is not. |
| Dictation in other fields (Perguntar à base, commit message, search) | Deferred to P2. P1's obligation is that the hook and `DictationBar` carry **no** Chat coupling, so wiring them later needs no refactor (VP-R5). |
| Voice commands ("enviar", "apagar isso"), wake words | Dictation transcribes; it does not interpret. A spoken "enviar" is text, not an action. |
| A second model-management surface | The Whisper model manager shipped in M12 owns models. The composer only ever *shows* readiness; it never offers a picker. |
| Speaker diarization, word-level timestamps, audio scrubbing/re-listening | Out for the second brain (M12) and out here. The output is plain editable text. |
| Persisting the raw audio | The take exists only for the length of the dictation, in memory, and is dropped on finalize/discard. Nothing is written to disk. |

---

## User Stories

### P1: Dictate into the composer ⭐ MVP

**User Story**: As a squad member, I want to press one button in the chat
composer and speak my prompt, so that I can hand the agent a long, detailed
request without typing it.

**Why P1**: It is the feature. Everything else exists to make this moment honest
and fast.

**Acceptance Criteria**:

1. WHEN the composer is rendered THEN the system SHALL show a **quiet microphone
   control** in the composer toolbar, leading the send button and sharing the
   attach control's visual weight — never an accent-filled call to action.
2. WHEN the user activates the microphone control THEN the system SHALL begin
   capturing audio and put the composer into **dictation mode in place**:
   the frame takes an accent ring, the toolbar's left cluster is replaced by the
   dictation transport, and the textarea SHALL keep its exact value, caret
   position, scroll offset and on-screen geometry (**no layout shift**, D-VP-7).
3. WHEN dictation mode is active THEN the transport SHALL show, simultaneously:
   a pulsing record indicator, the **elapsed time**, a **live level meter driven
   by real microphone signal**, a status line, and **Descartar** / **Concluir**
   controls.
4. WHEN the user activates **Concluir** THEN the system SHALL stop capture, flush
   the trailing segment, transcribe everything still queued, insert the results,
   and return the composer to its normal mode with focus and caret in the
   textarea after the inserted text.
5. WHEN the user presses **Esc** during dictation THEN the system SHALL discard:
   stop capture, drop every queued and in-flight segment, and **restore the
   composer's value and caret to exactly what they were before dictation
   started** (D-VP-9).
6. WHEN the user submits (send control or `Enter`) during dictation THEN the
   system SHALL finalize first (as in AC4) and send the resulting message —
   never send a half-transcribed prompt.
7. WHEN the composer holds focus AND the user presses the dictation shortcut
   THEN the system SHALL toggle dictation mode. The shortcut SHALL NOT collide
   with any binding already in the app's shortcut catalog.

**Independent Test**: Type "revisa o " in the composer, place the caret at the
end, press the mic, say "arquivo de configuração", press Concluir → the composer
reads "revisa o arquivo de configuração" with the caret after it, no layout
jumped, and nothing was typed by hand. Repeat and press Esc instead → the
composer reads "revisa o " again.

---

### P1: Words arrive while you are still talking ⭐ MVP

**User Story**: As a squad member, I want the transcription to appear phrase by
phrase as I speak, so that dictating feels like composing and not like submitting
a job.

**Why P1**: D-VP-2. Transcribing only at the end spends the whole thinking window
on a spinner.

**Acceptance Criteria**:

1. WHEN speech is followed by a **pause at or above the silence threshold** THEN
   the system SHALL close the current segment and hand it to the transcription
   queue **without interrupting capture** — the user may keep talking through the
   handoff.
2. WHEN a segment's transcription resolves THEN the system SHALL insert its text
   **at the composer's current caret**, joined to the surrounding text with
   correct spacing and capitalization (no doubled spaces, no space before
   punctuation, a capital after a sentence-ending mark).
3. WHEN a newly inserted segment lands THEN the system SHALL mark the inserted
   run briefly so the user can see what just arrived, and clear the mark
   automatically.
4. WHEN segments resolve **out of order** THEN the system SHALL still insert them
   in **spoken order** — a later segment that finishes early waits for its
   predecessors.
5. WHEN segments are queued or in flight THEN the transport SHALL show **how many
   are pending**, and SHALL NEVER display provisional or guessed words for them
   (D-VP-8).
6. WHEN a pause is shorter than the minimum-speech window THEN the system SHALL
   NOT cut a segment — a breath mid-sentence must not fragment the text.
7. WHEN a single segment reaches the maximum segment length THEN the system SHALL
   force a cut, so no segment grows without bound.
8. WHEN speech begins THEN the segment SHALL include a short **pre-roll** of audio
   captured before onset, and on cut a short **tail pad** after it, so the first
   and last phonemes are not clipped.

**Independent Test**: Dictate three sentences with a clear pause between each,
without stopping. The first sentence's text appears in the composer while the
second is being spoken; the final text contains all three in the order spoken,
with single spaces between them.

---

### P1: The first press never waits ⭐ MVP

**User Story**: As a first-time user with no Whisper model on disk, I want to
press the mic and just start talking, so that my thought isn't spent watching a
download bar.

**Why P1**: D-VP-5. Whisper's cold start (first-use model download plus a WASM
session build) is the single biggest threat to this feature feeling instant. It
is designed around, not apologized for.

**Acceptance Criteria**:

1. WHEN the user activates the microphone AND the model is not downloaded or the
   pipeline is not warm THEN the system SHALL **still start capturing
   immediately** and buffer segments — never blocking capture on readiness.
2. WHEN the engine is preparing THEN the transport SHALL show **real progress**
   (downloaded bytes / load phase, reusing the existing Whisper phase reporting)
   together with an explicit promise that the audio is being kept.
3. WHEN the engine becomes ready THEN the system SHALL drain the buffered queue
   **in spoken order**, inserting every segment captured during preparation.
4. WHEN the pointer enters or focus reaches the microphone control THEN the
   system SHALL begin engine readiness **in the background** (D-VP-6), and SHALL
   NOT download or load anything for a user who never interacts with it.
5. WHEN the user discards during preparation THEN the system SHALL release the
   microphone, drop the buffered audio, and abort the in-flight preparation.

**Independent Test**: With `whisper-models/` empty, press the mic and speak three
sentences continuously. Capture starts with no perceptible delay, the transport
shows honest download progress while recording, and when the model finishes
loading all three sentences appear in order.

---

### P1: Honest states

**User Story**: As a user, I want the app to tell me the truth about what it is
doing with my microphone, so I never lose a take or talk to something that isn't
listening.

**Why P1**: Losing a spoken thought is worse than never offering dictation.
`AudioRecorder`'s own doc comment already records why the meter exists: a timer
counts up identically whether the mic is capturing a voice or muted.

**Acceptance Criteria**:

1. WHEN the microphone is open but no signal has been detected for the silence
   notice window THEN the transport SHALL say so explicitly, and the level meter
   SHALL show a flat line rather than idle decoration.
2. WHEN silence continues to the auto-stop window THEN the system SHALL finalize
   automatically, and SHALL show a visible countdown before doing so — never
   leaving a microphone open indefinitely, never stopping without warning.
3. WHEN `getUserMedia` fails THEN the system SHALL distinguish **permission
   denied** from **no device available** with different copy, offer a retry
   inline in the composer, and leave the typed text untouched.
4. WHEN a segment's transcription fails THEN the system SHALL show the failure in
   the transport, keep the remaining queue running, and offer a retry that reuses
   the **buffered audio** — a failed segment SHALL NOT silently vanish.
5. WHEN dictation phase changes THEN the transport SHALL announce it to assistive
   technology via a polite live region; the elapsed time SHALL be exposed as a
   timer; the microphone control SHALL expose its on/off state.
6. WHEN dictation ends by **any** path — Concluir, Descartar, auto-stop, error,
   component unmount, or workspace/conversation change — THEN the system SHALL
   stop every media track and clear every timer, leaving no OS microphone
   indicator lit.

**Independent Test**: Start dictation and stay silent → the notice appears, then
the countdown, then it stops on its own. Deny microphone permission → the
composer explains and offers retry, and the typed draft is intact. Kill the model
mid-segment → the failure is visible and retryable.

---

### P1: Reusable by construction

**User Story**: As the next developer, I want dictation to be a hook and a
presentational component, so that adding it to another field is wiring, not a
rewrite.

**Why P1**: D-VP-3. Reusability decided after the fact is a refactor; decided
up front it is free.

**Acceptance Criteria**:

1. WHEN dictation logic is implemented THEN it SHALL live in its own module
   directory and SHALL NOT import from `chat/`, and the module-boundary test
   SHALL enforce that no dictation module imports from `src/main`.
2. WHEN the transport is implemented THEN it SHALL be **presentational** — driven
   entirely by props derived from the hook's state — with no engine, media or
   Chat access of its own.
3. WHEN the level meter is added to the design system THEN it SHALL take
   **numeric levels** and render bars, with all `MediaStream`/`AnalyserNode`
   handling remaining in the app (D-VP-10).
4. WHEN `PromptInput` is extended THEN the new props SHALL be **generic** (a
   toolbar overlay slot and an emphasis/highlight state), carry no dictation
   vocabulary, and SHALL be **backward compatible** — every existing `PromptInput`
   usage and test SHALL pass unchanged.
5. WHEN the segmentation and text-insertion rules are implemented THEN they SHALL
   be **pure functions** over plain data, unit-tested without WebAudio, a DOM
   media stack, or a real model.

**Independent Test**: `moduleBoundaries.test.ts` passes; the segmenter and
inserter test suites run in jsdom with no media mocks; `PromptInput`'s existing
test file passes untouched.

---

### P1: Craft

**User Story**: As a user, I want the dictation surface to feel like the rest of
the app — quiet until it matters, unmistakable when it is live.

**Acceptance Criteria**:

1. WHEN dictation mode engages or disengages THEN the transition SHALL be a
   crossfade plus a short slide in the 150–250 ms range on the project's easing
   tokens, and SHALL NOT animate layout-affecting properties.
2. WHEN `prefers-reduced-motion: reduce` is set THEN every dictation animation
   SHALL have a non-motion alternative (crossfade or instant), including the
   record-indicator pulse and the freshly-inserted-text mark.
3. WHEN rendered in **either theme** THEN every text and control in the dictation
   surface SHALL meet WCAG AA contrast (≥4.5:1 body, ≥3:1 large text and
   meaningful non-text indicators), verified with the project's contrast tooling.
4. WHEN dictation mode is active THEN the **send control SHALL remain the only
   accent-filled element** in the toolbar row; dictation state is carried by the
   frame ring, the record indicator and the live meter (Restrained strategy).
5. WHEN any copy is rendered THEN it SHALL come from `t()` in pt-BR, with zero
   inline strings.

**Independent Test**: Playwright-MCP screenshots of every dictation state in dark
and light; `contrast.spec.ts` extended to cover the transport and passing;
`noInlineStrings.test.ts` passing; the reduced-motion test covering the new
animations.

---

## Quality gate (VP-R7)

Non-negotiable exit conditions, mirroring M12's:

1. **VP-R7.1** — `npm run verify` green (typecheck node+web, **0 lint errors**,
   full Vitest suite) with **no regression** against the pre-feature baseline.
   ⚠️ The baseline written here at planning time (1570) was **stale** — it was
   M12's number, and `feat/second-brain` grew after it. Measured on the actual
   branch base (`59bfbca`) in a clean worktree before T14: **1959 tests across
   135 files**. That is the number "no regression" is against.
2. **VP-R7.2** — every **changed non-UI file** at ≥90% coverage per-file, with
   the new files' globs added to `vitest.config.ts` (an unlisted file is not
   measured). The inherited 14-file failing list SHALL NOT grow.
3. **VP-R7.3** — a real-Electron Playwright E2E covering the dictation surface
   with an injected fake engine, passing under `xvfb-run`.
4. **VP-R7.4** — Playwright-MCP visual pass over every state in **dark and
   light**, following `docs/visual-validation.md`.
5. **VP-R7.5** — all copy pt-BR via `t()`; `noInlineStrings.test.ts` green.

---

## Requirement index

| ID | Requirement |
| --- | --- |
| **VP-R1** | Dictate into the composer — in-place mode, preserve/restore draft, finalize, discard, submit-finalizes, composer shortcut |
| **VP-R2** | Streaming by pause — segment on silence, insert at caret, in-order, pending count, min/max segment, pre-roll/tail pad |
| **VP-R3** | First press never waits — capture before readiness, honest progress, drain in order, pre-warm on intent, clean abort |
| **VP-R4** | Honest states — silence notice, auto-stop with countdown, denied vs unavailable, segment failure + retry, a11y announcements, full teardown |
| **VP-R5** | Reusable by construction — no Chat coupling, presentational transport, DS `LevelMeter`, generic `PromptInput` extension, pure segmenter/inserter |
| **VP-R6** | Craft — motion budget, reduced motion, AA contrast both themes, Restrained accent discipline, pt-BR via `t()` |
| **VP-R7** | Quality gate — verify green, coverage, E2E, visual pass, i18n |
