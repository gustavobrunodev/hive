# Second Brain Specification

## Problem Statement

The squad accumulates hard-won knowledge (decisions, domain notes, how-tos,
meeting takeaways) that lives in people's heads, scattered chats, and dead docs.
There is no single, agent-maintained, version-controlled knowledge base the whole
squad curates in Markdown. Hive Desktop should host that "second brain": a squad
knowledge base the team grows by feeding it raw material — typed, pasted, or
spoken — and an agent that files it into a structured, cross-linked wiki.

## Goals

- [ ] Provision and keep current the **`second-brain` agent skill** automatically,
      exactly like BMAD (install if absent at startup, update on every launch).
- [ ] Give the squad a **squad-owned, git-versioned knowledge base** (a vault of
      Markdown) living inside the workspace.
- [ ] Make **ingestion effortless** from three entry points: the agent (CLI/chat),
      a **floating action button** for pasted text, and **audio** (uploaded file
      or in-app recording) transcribed **offline** by an **embedded Whisper**.
- [ ] Ship Whisper **embedded** (no external service, no terminal): default model
      `base`, user-selectable, models downloaded on demand and cached, with a
      **hardware-aware recommendation**.
- [ ] Deliver a **beautiful, intuitive, modern** surface shaped with `impeccable`,
      validated in the Playwright MCP, in both themes, fully pt-BR.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| A rendered in-app **answer** surface for `/second-brain-query` | Answers stay in the chat, where the agent already renders them. P1.1 adds a place to *compose the question* (SB-R9) — never a second answer viewport. |
| Bundling any Whisper model inside the installer | User chose **download-on-demand** (context.md D-SB-4); the installer stays lean, `base` is fetched on first transcription. |
| whisper.cpp / native ASR bindings, ffmpeg | User chose **Transformers.js (WASM/WebGPU)** (D-SB-1); audio is decoded/resampled with the browser's WebAudio, so no native toolchain and no ffmpeg. |
| Obsidian graph view / Obsidian Web Clipper integration | The vault is Obsidian-**compatible** Markdown, but Hive renders it with its own explorer/viewers; the Obsidian app itself is not embedded. |
| Owning/inventing the vault's internal structure | The `second-brain` skill's own `/second-brain` wizard scaffolds the vault (`raw/`, `wiki/…`, `index.md`, …). Hive **detects and browses** it; it never hand-scaffolds a parallel layout (avoids drift). |
| Editing a transcript's words with a rich audio editor, speaker diarization | Transcription yields plain editable text; diarization/word-level editing is out. |

---

## User Stories

### P1: Skill auto-provisioning ⭐ MVP

**User Story**: As a squad member, I want the `second-brain` skill installed and
kept up to date automatically, so the knowledge-base commands are always available
without me touching a terminal.

**Why P1**: Nothing else works until the agent has the skill. Mirrors the
already-shipped BMAD provisioning contract (user requirement, verbatim: "instalado
junto ao BMAD no momento da inicialização (caso não exista), e sempre atualizado
quando inicializar a aplicação, assim como o bmad").

**Acceptance Criteria**:

1. WHEN a workspace is opened AND `<ws>/.claude/skills/second-brain/SKILL.md` is
   absent THEN the system SHALL install it via the `skills` CLI (non-interactive,
   Claude Code agent) as part of the startup provisioning gate.
2. WHEN a workspace is opened AND the skill is already present THEN the system
   SHALL run its **update** on every launch, streaming progress into the same
   guided gate that BMAD uses.
3. WHEN the skill install/update fails THEN the system SHALL surface the error and
   let the user **continue anyway** into the work UI (never permanently blocked),
   exactly like the BMAD update gate.
4. WHEN provisioning runs THEN BMAD SHALL be provisioned first, then `second-brain`,
   in one continuous "preparando o workspace" gate.

**Independent Test**: Open a fresh workspace → observe the gate install second-brain
(SKILL.md appears on disk under `.claude/skills/second-brain/`); reopen → observe
an update run; simulate a failing CLI → "continuar mesmo assim" reaches the work UI.

---

### P1: Second Brain sidebar view ⭐ MVP

**User Story**: As a squad member, I want a dedicated "Second Brain" view in the
activity bar to see the state of our knowledge base, browse the wiki, and launch
knowledge actions, so the second brain is a first-class place in the app.

**Why P1**: The chosen scope (D-SB-3) is FAB **plus** a management surface; this is
the "gestão do conhecimento" home and the vault browser.

**Acceptance Criteria**:

1. WHEN the user selects the Second Brain entry in the activity bar THEN the system
   SHALL swap the left sidebar to the Second Brain view (sibling of Explorer /
   Source Control / Revisão via `SidebarHost`), keeping the persisted layout intact.
2. WHEN the vault (`<ws>/second-brain/`) does not exist THEN the view SHALL show an
   inviting empty state with a **"Configurar base"** action that launches the
   `/second-brain` setup wizard in the chat.
3. WHEN the vault exists THEN the view SHALL render its structure — the wiki index
   (`index.md`) and the `wiki/` tree (sources/entities/concepts/synthesis) — using
   the existing file tree/viewer, and open any file in the editor on click.
4. WHEN the user triggers **Ingerir**, **Consultar**, or **Organizar (lint)** from
   the view THEN the system SHALL launch the matching `/second-brain-ingest`,
   `/second-brain-query`, or `/second-brain-lint` command through the chat.
5. WHEN there are staged raw items awaiting ingestion THEN the view SHALL show their
   count as an ambient badge on the activity-bar entry.

**Independent Test**: Switch to the view with no vault → "Configurar base" launches
`/second-brain` in chat; with a vault present → the wiki tree renders and a file
opens; each action launches the correct slash command.

---

### P1: Floating ingestion — paste text ⭐ MVP

**User Story**: As a squad member, I want a floating button anywhere in the work UI
that lets me paste raw text and file it into the knowledge base in one gesture, so
capturing knowledge never interrupts my flow.

**Why P1**: The headline "botão de atalho flutuante para ingestão de dados … campo
aberto de texto para o usuário colar os dados".

**Acceptance Criteria**:

1. WHEN the user is in the work UI THEN a **floating action button (FAB)** SHALL be
   visible and, when activated, offer the ingestion modes (paste text / audio file
   / record audio).
2. WHEN the user chooses "Colar texto" and enters content and confirms THEN the
   system SHALL write the content to a new file under `<ws>/second-brain/raw/`
   (timestamped Markdown) AND launch `/second-brain-ingest` in the chat so the
   agent files it into the wiki.
3. WHEN the vault does not yet exist at ingestion time THEN the system SHALL prompt
   to set it up first (launch `/second-brain`) rather than writing to a missing path.
4. WHEN the content field is empty THEN the confirm action SHALL be disabled.
5. WHEN the FAB overlaps content THEN it SHALL be positioned to avoid the composer
   and be dismissible/quiet (no dead hover state, keyboard reachable, focus-visible).

**Independent Test**: Click FAB → "Colar texto" → paste → "Ingerir" → a new
`raw/<timestamp>.md` exists with the content and the chat shows a launched
`/second-brain-ingest` turn.

---

### P1: Embedded Whisper + audio-file ingestion ⭐ MVP

**User Story**: As a squad member, I want to drop an audio file and have it
transcribed offline, then filed into the knowledge base, so recorded knowledge
(a meeting, a voice memo) becomes searchable squad wisdom.

**Why P1**: "ingestão via arquivo de áudio com transcrição de áudio via whisper" +
"o whisper deve ser embedado na aplicação".

**Acceptance Criteria**:

1. WHEN the user chooses "Áudio (arquivo)" and selects a supported audio file THEN
   the system SHALL transcribe it **locally** (Transformers.js Whisper, WebGPU when
   available, CPU/WASM fallback) with no network call to any transcription service.
2. WHEN transcription needs a model that is not yet downloaded THEN the system SHALL
   download it on demand (default **`base`**), showing determinate progress, cache
   it in `userData`, and never re-download it.
3. WHEN transcription completes THEN the resulting text SHALL appear in an
   **editable** field so the user can correct it before ingesting.
4. WHEN the user selects a different Whisper model THEN subsequent transcriptions
   SHALL use it (default `base`, selectable per the model table).
5. WHEN the user confirms THEN the transcript SHALL be ingested via the same
   raw-write + `/second-brain-ingest` path as pasted text.
6. WHEN transcription fails (unsupported/corrupt audio, model load error) THEN the
   system SHALL show a clear pt-BR error and keep the user's audio/text recoverable.

**Independent Test**: With `base` absent, transcribe a short WAV → model downloads
with progress → editable transcript appears → "Ingerir" writes `raw/` and launches
ingest. Re-run → no re-download.

---

### P1: In-app audio recorder ⭐ MVP

**User Story**: As a squad member, I want to record audio directly in the app and
have it transcribed and ingested, so I can brain-dump knowledge by speaking.

**Why P1**: "ingestão via áudio (a interface deve prover um gravador que grave o
áudio, converta para arquivo de áudio e transcreva com whisper)".

**Acceptance Criteria**:

1. WHEN the user chooses "Gravar áudio" THEN the system SHALL request microphone
   permission and present a recorder with record/stop and elapsed time.
2. WHEN the user stops THEN the captured audio SHALL be converted to a WAV/PCM the
   Whisper pipeline accepts and transcribed on the same local pipeline as file mode.
3. WHEN microphone permission is denied THEN the system SHALL show a clear pt-BR
   explanation and a way to retry (no silent failure).
4. WHEN the user re-records THEN the previous take SHALL be discarded cleanly and
   the media stream released (no leaked recorder/track).
5. WHEN transcription completes THEN it SHALL flow into the same editable-transcript
   → ingest path as file mode.

**Independent Test**: "Gravar áudio" → grant mic → record a few seconds → stop →
transcript appears → "Ingerir" writes `raw/` and launches ingest; deny mic → clear
error + retry.

---

### P1: Ingestion via the agent (chat) ⭐ MVP

**User Story**: As a squad member already chatting with the agent, I want to ingest
knowledge by command, so I don't have to leave the conversation.

**Why P1**: "Para ingestão de dados deve ser possível via: CLI com o agente."

**Acceptance Criteria**:

1. WHEN the user types `/second-brain-ingest` (or the other second-brain commands)
   in the composer THEN the slash menu SHALL offer them (they are discovered like
   any installed skill).
2. WHEN launched THEN the command SHALL run as a normal workflow turn against the
   provisioned skill.

**Independent Test**: Type `/` in the composer → `second-brain-ingest`/`-query`/
`-lint` appear and launch as turns.

---

### P2: Hardware-aware model recommendation & model manager

**User Story**: As a user unsure which model to pick, I want the app to recommend
the best Whisper model for my machine and let me manage downloads, so I get good
speed/quality without guessing.

**Why P2**: The base default already works end-to-end; recommendation is an
enhancement ("Caso seja possível, seria interessante se a aplicação conseguisse
recomendar o modelo mais compatível de acordo com o hardware").

**Acceptance Criteria**:

1. WHEN the user opens model selection THEN the system SHALL show the model table
   (size, parameters, ~VRAM, relative speed) and mark the **recommended** model for
   the detected hardware (best-effort: WebGPU availability + RAM/VRAM), defaulting
   to `base` when detection is inconclusive.
2. WHEN the user manages models THEN they SHALL see which are downloaded, download
   or delete any, with progress, from a **model manager**.
3. WHEN a recommendation cannot be computed THEN the system SHALL fall back to
   `base` and say so, never blocking transcription.

**Independent Test**: Open model manager → table renders with a "Recomendado" badge
on one row appropriate to the machine; download/delete a model updates its state.

---

### P1.1: Ask the base anything, from anywhere ⭐ (post-M12 increment)

**User Story**: As a squad member, I want one shortcut that lets me ask the
knowledge base anything without leaving what I'm doing, so consulting the squad's
memory costs nothing.

**Why P1.1**: A knowledge base is read far more often than it is written. M12
shipped a `Consultar` button that launched a *question-less* `/second-brain-query`
and left the user to type the question into a chat the agent had already asked
about — one indirection too many for the most frequent action.

**Acceptance Criteria**:

1. WHEN the user presses `Ctrl/Cmd+Shift+K` anywhere in the work UI, or activates
   "Perguntar à base" from the Second Brain view or the floating button, THEN the
   system SHALL open an ask surface focused on a single question field.
2. WHEN the user submits a question THEN the system SHALL launch
   `/second-brain-query <pergunta>` as a chat turn (whitespace collapsed to one
   line), and the answer SHALL render in the chat like any other agent turn.
3. WHEN the field is empty THEN the surface SHALL offer question openers that
   teach what the base can answer, and picking one SHALL fill the field (caret at
   the end) rather than asking immediately; an empty question SHALL never launch.
4. WHEN the workspace has previously asked questions THEN the surface SHALL offer
   them back (newest first, deduplicated), per workspace.
5. WHEN raw material is staged but not yet filed into the wiki THEN the surface
   SHALL say so, since the answer cannot include it.
6. WHEN no vault exists THEN the surface SHALL offer "Configurar base" instead of
   a question field.

**Independent Test**: `Ctrl+Shift+K` from the Explorer → type a question → Enter →
the chat shows a `/second-brain-query <pergunta>` turn; reopen → the question is
listed under "Perguntas recentes".

---

### P1.2: The app keeps the health-check cadence ⭐ (post-M12 increment)

**User Story**: As a squad member, I want the app to track the `second-brain`
skill's documented maintenance practice — run `/second-brain-lint` after every 10
ingests or monthly — and remind me when it comes due, so the wiki stays healthy
without anyone remembering the rule.

**Why P1.2**: The practice is documented in the skill and nowhere in the product.
An un-tended wiki degrades silently, which is exactly the failure the knowledge
base exists to prevent.

**Acceptance Criteria**:

1. WHEN the Second Brain view is open THEN it SHALL show the base's health: ingests
   since the last check (against the threshold of 10), when it was last checked,
   and what would make the next check due.
2. WHEN an ingest is launched from the app THEN the system SHALL record it against
   the active workspace's cadence.
3. WHEN a health-check is launched from any surface THEN the system SHALL record it,
   resetting the ingest count and both clocks.
4. WHEN the cadence comes due — 10 ingests since the last check, or 30 days with at
   least one ingest in the window — THEN the system SHALL surface an ambient,
   non-blocking reminder with a shortcut that starts the agent session
   (`/second-brain-lint`), plus a persistent marker on the activity-bar entry.
5. WHEN the user postpones the reminder THEN it SHALL stay quiet for a week without
   pretending the check ran; the sidebar SHALL keep showing the truth and keep the
   action available.
6. WHEN the cadence has never been recorded, or its ledger is lost/corrupt, THEN
   the system SHALL read as a fresh base rather than nagging or failing.

**Independent Test**: Launch 10 ingests → the reminder appears with the rail dot;
"Depois" quiets it for a week (panel still says the base needs a review);
"Revisar agora" launches `/second-brain-lint` and the counter returns to 0/10.

---

## Edge Cases

- WHEN the `skills` CLI is unavailable / offline at startup THEN provisioning SHALL
  fail soft (continue-anyway), matching BMAD's gate.
- WHEN a workspace switch happens mid-session THEN the Second Brain view + FAB SHALL
  rebind to the new workspace's vault (no stale vault path).
- WHEN the audio is very long THEN transcription SHALL stream/chunk progress and not
  freeze the UI (inference off the main thread — worker/WebGPU).
- WHEN two raw files are staged in the same second THEN filenames SHALL not collide.
- WHEN WebGPU is unavailable THEN the pipeline SHALL fall back to WASM/CPU and still
  produce a transcript (slower), surfaced honestly.
- WHEN the model download is interrupted THEN a partial model SHALL not be treated
  as complete (atomic finalize; resume or re-fetch cleanly).
- WHEN the vault is deleted on disk while the view is open THEN the view SHALL fall
  back to its empty/"Configurar base" state.
- WHEN the pasted/transcribed content contains no text THEN ingestion SHALL be
  refused with a clear message.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SB-R1.1 | P1: Provisioning — install if absent | Design | Pending |
| SB-R1.2 | P1: Provisioning — update on launch | Design | Pending |
| SB-R1.3 | P1: Provisioning — fail-soft gate | Design | Pending |
| SB-R1.4 | P1: Provisioning — BMAD then second-brain | Design | Pending |
| SB-R2.1 | P1: Sidebar view — activity-bar entry + swap | Design | Pending |
| SB-R2.2 | P1: Sidebar view — empty state → `/second-brain` | Design | Pending |
| SB-R2.3 | P1: Sidebar view — vault/wiki browser | Design | Pending |
| SB-R2.4 | P1: Sidebar view — launch ingest/query/lint | Design | Pending |
| SB-R2.5 | P1: Sidebar view — staged-raw badge | Design | Pending |
| SB-R3.1 | P1: FAB — visible, mode menu | Design | Pending |
| SB-R3.2 | P1: FAB — paste → raw write + ingest | Design | Pending |
| SB-R3.3 | P1: FAB — no-vault guard | Design | Pending |
| SB-R3.4 | P1: FAB — empty guard | Design | Pending |
| SB-R3.5 | P1: FAB — placement/a11y | Design | Pending |
| SB-R4.1 | P1: Audio file — local transcription | Design | Pending |
| SB-R4.2 | P1: Whisper — on-demand model download + cache | Design | Pending |
| SB-R4.3 | P1: Audio — editable transcript | Design | Pending |
| SB-R4.4 | P1: Whisper — model selection (default base) | Design | Pending |
| SB-R4.5 | P1: Audio — transcript → ingest path | Design | Pending |
| SB-R4.6 | P1: Audio — error handling | Design | Pending |
| SB-R5.1 | P1: Recorder — capture + permission | Design | Pending |
| SB-R5.2 | P1: Recorder — convert + transcribe | Design | Pending |
| SB-R5.3 | P1: Recorder — permission-denied UX | Design | Pending |
| SB-R5.4 | P1: Recorder — re-record cleanup | Design | Pending |
| SB-R5.5 | P1: Recorder — → ingest path | Design | Pending |
| SB-R6.1 | P1: Chat — slash-menu discovery | Design | Pending |
| SB-R6.2 | P1: Chat — launch as turn | Design | Pending |
| SB-R7.1 | P2: Recommendation — table + recommended | Design | Pending |
| SB-R7.2 | P2: Model manager — download/delete/status | Design | Pending |
| SB-R7.3 | P2: Recommendation — fallback to base | Design | Pending |
| SB-R8.1 | NFR: no regression (verify green) | Tasks | Pending |
| SB-R8.2 | NFR: ≥90% per-file coverage (non-UI) | Tasks | Pending |
| SB-R8.3 | NFR: real-Electron E2E | Tasks | Pending |
| SB-R8.4 | NFR: Playwright-MCP visual pass (dark+light) | Tasks | Pending |
| SB-R8.5 | NFR: all copy pt-BR via `t()` | Tasks | Pending |
| SB-R9.1 | P1.1: Ask — reachable from shortcut/panel/FAB | Tasks | Verified |
| SB-R9.2 | P1.1: Ask — question inside `/second-brain-query`, answer in chat | Tasks | Verified |
| SB-R9.3 | P1.1: Ask — openers teach; empty never launches | Tasks | Verified |
| SB-R9.4 | P1.1: Ask — recent questions per workspace | Tasks | Verified |
| SB-R9.5 | P1.1: Ask — staged-but-unfiled caveat | Tasks | Verified |
| SB-R9.6 | P1.1: Ask — no-vault guard | Tasks | Verified |
| SB-R10.1 | P1.2: Health — cadence shown in the panel | Tasks | Verified |
| SB-R10.2 | P1.2: Health — ingests recorded | Tasks | Verified |
| SB-R10.3 | P1.2: Health — a check resets count + clocks | Tasks | Verified |
| SB-R10.4 | P1.2: Health — ambient reminder + rail marker when due | Tasks | Verified |
| SB-R10.5 | P1.2: Health — snooze without faking a run | Tasks | Verified |
| SB-R10.6 | P1.2: Health — fresh/corrupt ledger reads as healthy | Tasks | Verified |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 45 functional + 5 NFR = 50 total; mapping to tasks happens in `tasks.md`.

---

## Success Criteria

- [ ] A non-terminal user opens a workspace, and second-brain is provisioned
      automatically alongside BMAD.
- [ ] From the FAB, pasted text is filed into the wiki by the agent in under a
      minute, with no terminal.
- [ ] A short audio file and an in-app recording are both transcribed **offline**
      and ingested, with the default `base` model downloaded once on demand.
- [ ] The Second Brain view lets the squad browse the wiki and launch
      ingest/query/lint without typing a command.
- [ ] The whole surface is first-party-beautiful in both themes (Playwright-MCP
      validated), fully pt-BR, with no regression and per-file coverage held.
