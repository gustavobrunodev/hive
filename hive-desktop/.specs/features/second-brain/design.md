# Design — Second Brain

**Spec:** `spec.md` · **Context:** `context.md`

Realizes the four locked decisions (D-SB-1…4) + derived (D-SB-5…9). Reuses the
house architecture: DI'd services in `main/` (no `electron` import, unit-testable
against fakes), IPC via `ipcMain.handle`/`.on`, a preload bridge namespace, and
renderer surfaces built on `@hive/design-system` shaped with `impeccable`.

---

## 1. Architecture at a glance

```
┌────────────────────────────── main (Node) ──────────────────────────────┐
│ secondBrainService.ts   install()/update() via `skills` CLI (ProcessRunner)│
│                         + detect() disk check + resolveVault()             │
│ secondBrainVault.ts     stageRaw(ws, text) → <ws>/second-brain/raw/*.md    │
│ whisperModelStore.ts    catalog + userData store + download/delete/status  │
│ whisperHardware.ts      os.totalmem + app.getGPUInfo → recommend()         │
│ hive-model: protocol    serves userData/whisper-models/** to the renderer   │
│ session media handler   grants microphone to the sandboxed renderer         │
└───────────────▲───────────────────────────── IPC (window.hive.secondBrain,│
                │                                     window.hive.whisper) ───┘
┌───────────────┴────────────────── renderer (sandboxed Chromium) ──────────┐
│ ActionRail (+'brain' view)  SidebarHost (+'brain' body)                    │
│ SecondBrainPanel.tsx        vault status / wiki browser / action launchers │
│ SecondBrainFab.tsx          floating button → mode menu                     │
│ IngestPanel.tsx             text | audio-file | record → editable → ingest  │
│ AudioRecorder.tsx           MediaRecorder capture → Blob                     │
│ whisper/useWhisper.ts       @huggingface/transformers pipeline (WebGPU/WASM)│
│ whisper/audio.ts            decode+resample → Float32 16 kHz mono (WebAudio) │
│ whisper/ModelManager.tsx    table + downloaded/recommended + download/delete │
└────────────────────────────────────────────────────────────────────────────┘
```

Transcription **inference** is renderer-side (Transformers.js). Everything with a
filesystem or network side-effect (skill install/update, model download, raw
staging, hardware probe) is **main-side**, matching the sandbox model.

---

## 2. Skill provisioning — `secondBrainService.ts`

Mirrors `bmadService.ts` shape/DI exactly (inject `ProcessRunner`; a `SkillEvent`
stream identical to `BmadEvent`: `step | progress | done | error`).

**Install command** (non-interactive, verified flag shape from the `skills` CLI —
vercel-labs/skills; `-y` non-interactive, `-a claude-code` targets Claude Code,
run with `cwd = workspace` for project scope so it lands in `<ws>/.claude/skills/`):

```
npx -y skills add https://github.com/nicholasspisak/second-brain \
    --skill second-brain -a claude-code -y
```

**Update command** (re-run of `add` is idempotent and refreshes; if the CLI exposes
`skills update <name>` it is preferred — resolved at T1 against the real CLI, same
way B1 verified BMAD):

```
npx -y skills update second-brain        # fallback: re-run `add … -y`
```

- `detect(ws)` = disk check of `<ws>/.claude/skills/second-brain/SKILL.md`
  (the marker, analogous to BMAD's `_bmad/_config/manifest.yaml`, D13/C4).
- `install()` runs when absent; `update()` runs when present. Both stream events.
- `resolveVault(ws)`: return the first of `<ws>/second-brain/` (has `wiki/index.md`
  or `raw/`) else scan one level for a dir containing `wiki/index.md`; else `null`
  (not configured). Best-effort, cheap.
- Failures are surfaced but **non-fatal** (SB-R1.3) — the gate offers
  "continuar mesmo assim".

> **T1 spike (like B1/B2):** run the real `skills add` in a throwaway workspace to
> confirm (a) non-interactive flags, (b) exact update subcommand, (c) that it writes
> `.claude/skills/second-brain/SKILL.md` and the four sub-skills, (d) output markers
> for the event parser. Capture fixtures for the parser tests. Record findings in
> STATE.md before building on assumptions (npm-distribution lesson).

---

## 3. Vault staging — `secondBrainVault.ts`

Pure FS helper (inject `fs`/paths; no electron), unit-testable on a temp dir.

- `stageRaw(ws, content, ext = 'md'): Promise<string>` — ensures
  `<ws>/second-brain/raw/` exists, writes `ingest-<YYYYMMDD-HHmmss>-<rand>.md`
  (random suffix avoids same-second collisions, edge case), returns the rel path.
  Refuses empty content. Path-escape guarded (reuse `fsService` conventions).
- `countRawPending(ws)` — number of files in `raw/` (drives the activity-bar badge,
  SB-R2.5). Best-effort; 0 when absent.
- The vault is **git-versioned** (D-SB-2); staging is a normal workspace write, so it
  shows up in M10 Source Control and the M11 review flow for free.

---

## 4. Whisper — embedded, offline, on-demand

### 4.1 Engine (renderer) — `whisper/useWhisper.ts`

`@huggingface/transformers` v3 pipeline, created lazily and kept warm:

```ts
import { pipeline, env } from '@huggingface/transformers'
env.allowRemoteModels = false          // never fetch from HF in the renderer
env.localModelPath = 'hive-model:///'  // custom scheme → userData store (§4.3)
env.backends.onnx.wasm.wasmPaths = /* local bundled ort-wasm dir */

const asr = await pipeline('automatic-speech-recognition', repo, {
  device: (await gpuAvailable()) ? 'webgpu' : 'wasm',
  dtype: device === 'webgpu' ? 'fp32' : 'q8',
  progress_callback: (p) => onModelLoadProgress(p)   // model-load %
})
const { text } = await asr(float32Pcm16k, {
  language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5
})
```

- `repo` = `onnx-community/whisper-<size>` (resolved from the selected model id).
- `gpuAvailable()` = `!!navigator.gpu` and a successful `requestAdapter()`; on
  failure, WASM/CPU (SB-R4.1 honest fallback).
- `chunk_length_s`/`stride_length_s` give long-audio chunked progress (edge case).
- Inference runs off the main thread (WebGPU, or ORT's worker for WASM) so the UI
  stays responsive.

### 4.2 Audio decode — `whisper/audio.ts` (no ffmpeg)

`fileOrBlob → AudioBuffer` via `new AudioContext().decodeAudioData`, then
`OfflineAudioContext(1, …, 16000)` to resample to **16 kHz mono Float32**, the exact
input the ASR pipeline expects. Pure-ish (WebAudio) — covers both file mode and the
recorder's Blob. Rejects unsupported/corrupt audio with a typed error (SB-R4.6).

### 4.3 Model store (main) — `whisperModelStore.ts` + `hive-model:` protocol

- **Catalog** (static, from the user's table) — one entry per model:
  `{ id, repo, params, sizeMB, approxVramGB, relativeSpeed, multilingual }` for
  `tiny(.en) | base(.en) | small(.en) | medium(.en) | large-v3 | large-v3-turbo`.
- **Store**: `userData/whisper-models/<repo>/…`. `status()` returns per-model
  `downloaded: boolean` (marker file present after atomic finalize).
- **`downloadModel(id, onProgress)`**: fetch the HF repo file tree
  (`https://huggingface.co/api/models/<repo>/tree/main`), download each required
  file (config/tokenizer/preprocessor + `onnx/encoder_model.onnx` +
  `onnx/decoder_model_merged.onnx`, quantized variants as needed) into a **temp dir**,
  then `rename` to the final dir (atomic, D-SB-4). Streams byte progress.
- **`deleteModel(id)`**: remove the dir.
- **Custom protocol**: `protocol.registerSchemesAsPrivileged([{ scheme: 'hive-model',
  privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP:
  false } }])` before `app.whenReady`, then `protocol.handle('hive-model', (req) =>
  respond with the file under userData/whisper-models resolved from the URL path)`.
  Path-escape guarded. This is how the offline renderer reads model bytes under CSP.

### 4.4 CSP change (scoped)

`src/renderer/index.html` CSP becomes:

```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
media-src 'self' blob:; connect-src 'self' hive-model:; worker-src 'self' blob:
```

Only the minimum for ORT WASM (`'wasm-unsafe-eval'`), the model scheme
(`hive-model:`), recorder playback (`blob:`), and ORT's worker (`worker-src`). No
remote origins — the renderer still never talks to the network.

### 4.5 Hardware recommendation (main) — `whisperHardware.ts` (P2)

`recommend()` → `{ recommendedId, reason, gpu: boolean, ramGB }`:
- `ramGB = os.totalmem()/2**30`; `gpu` from `app.getGPUInfo('basic')` (best-effort;
  VRAM is not reliably exposed cross-platform — documented honestly).
- Heuristic (advisory only, never blocks; falls back to `base` when unsure,
  SB-R7.3), loosely tracking the table:
  - no WebGPU or RAM < 8 → `tiny`/`base`
  - WebGPU + RAM ≥ 16 → `small` (or `medium` if a discrete GPU is detected)
  - else → `base`
- The renderer marks the recommended row; the user always overrides.

---

## 5. Renderer surfaces (impeccable, DS-based)

### 5.1 Activity bar + sidebar view (SB-R2)
- `SidebarView` union (in `ui/ActionRail.tsx`) gains `'brain'`; add a `RailViewButton`
  with a new `BrainIcon` (or reuse the `HiveLogo mark="brain"` motif) + a
  `rawPending` count badge (SB-R2.5).
- `SidebarHost` gains a `brain?: ReactNode` slot; `WorkUI` renders `SecondBrainPanel`
  into it and owns the `activeView` state (already there for scm/review).
- Keyboard: an `aria-keyshortcuts` (e.g. `Control+Shift+B`) consistent with SCM's
  `Control+Shift+G`.

### 5.2 `SecondBrainPanel.tsx` (SB-R2.2–2.4)
- **No vault** → empty state (illustration + copy) with **"Configurar base"** →
  `chat.launchAction({ prompt: '/second-brain' })`.
- **Vault present** → header (vault name + raw-pending chip), the `wiki/index.md`
  rendered via the existing Markdown viewer, and a compact `wiki/` tree (reuse
  `explorer` `FileTree`) that opens files in the editor.
- Action row: **Ingerir** (opens the FAB's `IngestPanel`), **Consultar**
  (`/second-brain-query`), **Organizar** (`/second-brain-lint`) — all via
  `launchAction`. Reuses `ui/studioPrompts.ts` conventions for prompt strings.

### 5.3 `SecondBrainFab.tsx` (SB-R3.1, 3.5)
- Fixed floating button, bottom-right of the work area, **outside** the resizable
  body so it never disturbs `hive.workLayout`; offset above the composer so it never
  covers it (SB-R3.5). Focus-visible ring, `aria-haspopup`, keyboard reachable.
- Activating opens a small popover/menu (DS `Popover`/`DropdownMenu`) with three
  modes → each opens `IngestPanel` on the right tab.
- Quiet by default (coral accent, calm motion 150–250ms per PRODUCT.md).

### 5.4 `IngestPanel.tsx` (SB-R3.2–3.4, R4.3–4.5, R5.5)
A DS `Sheet`/`Dialog` with three tabs sharing one **editable transcript/textarea**
and one **"Ingerir"** action:
- **Colar texto** — textarea; empty → disabled confirm (SB-R3.4).
- **Áudio (arquivo)** — file picker → `whisper/audio.ts` decode → `useWhisper`
  transcribe (model-download progress if needed) → fills the editable field.
- **Gravar áudio** — embeds `AudioRecorder`; on stop → decode → transcribe → fills
  the field.
- **Model selector** (default `base`; per D-SB-6 language default Portuguese) +
  a link to the **Model Manager** (§5.6).
- **Ingerir** → `secondBrain.stageRaw(ws, text)` then `launchAction('/second-brain-ingest')`
  (D-SB-5). No-vault → offer "Configurar base" first (SB-R3.3).

### 5.5 `AudioRecorder.tsx` (SB-R5)
- `navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaRecorder` → chunks →
  `Blob`. Record/stop, elapsed timer, simple level meter. Re-record discards the
  prior take and **stops every track** (no leak, SB-R5.4).
- Permission denied → clear pt-BR message + retry (SB-R5.3). Main grants `media` via
  `session.defaultSession.setPermissionRequestHandler` (only `media`, only for the
  app origin).

### 5.6 `whisper/ModelManager.tsx` (P2, SB-R7)
- Table from the catalog: size, params, ~VRAM, relative speed; per-row
  **downloaded / recomendado** badges + download/delete with progress. Opens from
  `IngestPanel` and (optionally) the app settings sheet.

---

## 6. Provisioning gate wiring (D-SB-7, SB-R1.4)

`App.tsx` runs the gate chain workspace → agent → role → **provisioning**. Today
provisioning = BMAD install/update (`GuidedInstall`/`UpdateGate`). Extend it:

- After BMAD completes, run a **second-brain step** in the same gate surface,
  streaming `SkillEvent`s (install when `detect()` false, else update).
- Keep it one continuous "Preparando o workspace" experience; both steps fail-soft.
- Minimal-churn option: a small `ensureSecondBrain(ws)` async-generator consumed by
  a thin extension of `UpdateGate` (or a sibling gate component reusing its shell).
  New i18n keys under a `secondBrain` block.

---

## 7. IPC / preload contract (`window.hive.secondBrain`, `window.hive.whisper`)

Following the preload namespace convention (`preload/index.ts`):

```ts
secondBrain: {
  // provisioning (streamed, like updateBmad)
  install(ws, onEvent): () => void
  update(ws, onEvent):  () => void
  isProvisioned(ws): Promise<boolean>
  // vault
  getVault(ws): Promise<{ path: string | null, name: string | null, rawPending: number }>
  stageRaw(ws, content): Promise<{ relPath: string }>
}
whisper: {
  listModels(): Promise<WhisperModelInfo[]>              // catalog + downloaded flag
  modelStatus(id): Promise<{ downloaded: boolean }>
  downloadModel(id, onProgress): () => void              // streamed progress; returns canceller
  deleteModel(id): Promise<void>
  recommend(): Promise<HardwareRecommendation>           // P2
}
```

- Transcription is **not** IPC (renderer-local); only model bytes cross via the
  `hive-model:` protocol, and hardware/model-file management via these handlers.
- Types live in a pure `secondBrainTypes.ts` / `whisperTypes.ts` (renderer derives
  from `window.hive`, per the M11 lesson — no `src/main/*` import in the renderer,
  keep the preload `.d.ts` importing only pure type modules).

---

## 8. Data & types (sketch)

```ts
type SkillEvent = { type:'step'; id:string; label:string }
  | { type:'progress'; pct?:number; message:string }
  | { type:'done'; ok:true } | { type:'error'; message:string; detail?:string }

interface WhisperModelInfo {
  id: 'tiny'|'tiny.en'|'base'|'base.en'|'small'|'small.en'|'medium'|'medium.en'|'large-v3'|'large-v3-turbo'
  repo: string; params: string; sizeMB: number
  approxVramGB: number; relativeSpeed: string; multilingual: boolean
  downloaded: boolean
}
interface HardwareRecommendation { recommendedId: WhisperModelInfo['id']; reason: string; gpu: boolean; ramGB: number }
```

---

## 9. Testing strategy (SB-R8)

- **Unit (main, ≥90% per-file):** `secondBrainService` (fake `ProcessRunner`,
  event parsing from captured fixtures), `secondBrainVault` (temp dir), model store
  (fake fetch + temp dir, atomic finalize, protocol resolver + path-escape),
  `whisperHardware` (injected `os`/gpu probe).
- **Unit (renderer, `.test.ts` w/ `createElement` — M11 lesson):** `whisper/audio.ts`
  (decode/resample math with a synthetic buffer), `IngestPanel` (guards, ingest
  wiring with a mocked bridge + `launchAction`), `SecondBrainPanel` (empty vs vault),
  `SecondBrainFab` (menu, focus), `AudioRecorder` (mocked `getUserMedia`/`MediaRecorder`),
  `ModelManager`. `useWhisper` mocks `@huggingface/transformers`.
- **E2E (real-Electron, `_electron.launch` under xvfb):** provisioning gate reaches
  the work UI; switch to the Second Brain view; open the FAB; paste text → `stageRaw`
  writes `raw/*.md` on disk (assert on-disk) and a `/second-brain-ingest` turn is
  launched. Transcription is stubbed in E2E (no model/GPU in sandbox); the decode →
  Float32 path is unit-tested; a scripted transcript exercises the ingest path.
- **Visual (Playwright-MCP, dark+light):** FAB + menu, IngestPanel (3 tabs), model
  download progress, recorder states, SecondBrainPanel (empty + populated), model
  manager. `impeccable` polish pass. Screenshots under `.playwright-mcp/`.
- **pt-BR:** `noInlineStrings` stays green; every string via `t()`.
- **verify:** `npm run verify` (typecheck + 0 lint errors + full unit suite) green;
  no regression against the current 1299-test baseline.

---

## 10. Risks & open questions

- **OQ1 — `skills` CLI exact update subcommand + output markers.** Resolve at the T1
  spike against the real CLI (like B1). Fallback: idempotent `add … -y`.
- **OQ2 — Transformers.js under Electron CSP + `hive-model:` protocol.** Highest
  technical risk. De-risk with a T9 spike: load `whisper-tiny` from a locally-served
  model dir via the custom scheme and transcribe a 3 s clip, WebGPU + WASM paths,
  before building the UI on it. Confirms the CSP additions, `wasmPaths`, and
  `env.localModelPath` scheme resolution.
- **OQ3 — ORT WASM asset bundling in electron-vite.** The `ort-wasm*.wasm`/worker
  files must ship locally and resolve at runtime (renderer is `file://`-ish). Pin the
  path via `env.backends.onnx.wasm.wasmPaths`; validate in the T9 spike.
- **OQ4 — Model download file list per whisper repo.** Use the HF tree API rather
  than a hard-coded list, so quantization variants are covered; validate the minimal
  required-file set in the T10 tests with a recorded tree fixture.
- **OQ5 — WebGPU availability in the packaged app / on the user's machine.** Always
  provide the WASM fallback; recommendation is advisory. VRAM detection is
  best-effort and never gates.
- **OQ6 — Long-audio memory.** Chunked decoding/inference (`chunk_length_s`); cap or
  warn on very large files. Refine in P2 if needed.

Deferred to P2/P3: rendered query-answer surface, model recommendation polish,
speaker diarization, word-level transcript editing, Obsidian graph, auto language
detection tuning.
