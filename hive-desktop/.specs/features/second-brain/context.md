# Context — Second Brain

Gray-area decisions captured before design, from the user via `AskUserQuestion`
(2026-07-25). These are **locked**; design.md realizes them.

---

## D-SB-1 — Whisper engine: Transformers.js (WASM/WebGPU) ✅

**Decision:** Embed Whisper via **`@huggingface/transformers`** (Transformers.js v3)
running **in the renderer**, using **WebGPU when available** and falling back to
**WASM/CPU**. Models are **ONNX** Whisper repos (`onnx-community/whisper-<size>` /
`Xenova/whisper-<size>`), downloaded on demand.

**Chosen over:**
- *whisper.cpp native bindings (`nodejs-whisper`)* — fastest/most accurate, but
  requires **prebuilt native binaries per platform + per Electron ABI** in the
  installer (node-gyp/cmake), materially harder packaging. Rejected.
- *Prebuilt whisper.cpp binary spawned as a process* — no node-gyp at runtime but
  still one native binary per platform in the bundle **and a bundled ffmpeg** for
  audio conversion. Rejected.

**Why:** truly "embedded" with **zero native toolchain**, cross-platform for free,
and it aligns with the user's own **VRAM-based** model table (that table describes
GPU-accelerated Whisper — WebGPU maps to it directly). Audio is decoded/resampled
to 16 kHz mono with the browser's **WebAudio (`OfflineAudioContext`)**, so **no
ffmpeg** is needed either.

**Consequences (load-bearing for design):**
- Renderer CSP is currently `default-src 'self'; script-src 'self'` — the ONNX
  Runtime Web **WASM backend needs `'wasm-unsafe-eval'`** added to `script-src`
  (scoped, minimal). WebGPU needs no CSP change.
- To keep the sandboxed renderer **offline** (network stays in main, per house
  architecture), model files are downloaded by **main** into `userData` and served
  to Transformers.js via a **custom privileged `hive-model:` protocol** +
  `env.allowRemoteModels = false` / `env.localModelPath`. The renderer never hits
  the network; `connect-src` gains only `hive-model:`.
- ONNX Runtime Web WASM/worker assets are **bundled locally** (no CDN).
- Transcription runs off the main thread (WebGPU/worker) so long audio never
  freezes the UI.

---

## D-SB-2 — Vault location: in the workspace, git-versioned ✅

**Decision:** The knowledge base (vault) lives at **`<workspace>/second-brain/`**,
committed and shared with the squad via git — Markdown as the squad's collective
source of truth. One vault per project/repo.

**Chosen over:** a single global vault (userData / fixed home dir) or a
user-chosen arbitrary path.

**Why:** the brief is explicit — *"o second brain da Squad de desenvolvimento …
servindo como fonte de conhecimento da Squad"*. Per-workspace + git is what makes
it a **squad** brain (reviewable, shareable, versioned) rather than one person's.

**Consequences:**
- Hive **detects** and **browses** the vault; the `second-brain` skill's own
  `/second-brain` wizard **scaffolds** it (Hive never hand-builds a parallel layout).
- The default vault folder name is `second-brain`; if a user's wizard run named it
  differently, Hive detects the vault by locating a `wiki/index.md` marker under the
  workspace (best-effort), else falls back to `<ws>/second-brain/`.
- FAB/recorder ingestion writes raw material to `<ws>/second-brain/raw/`. If the
  vault is absent, ingestion first offers **"Configurar base"** (`/second-brain`).
- The vault path binds to the **active workspace** and rebinds on workspace switch
  (reuse the M8 rebind convention).

---

## D-SB-3 — P1 scope: FAB + management sidebar view ✅

**Decision:** P1 delivers the **floating ingestion button** (paste text / audio
file / record+transcribe) **and** a **"Second Brain" activity-bar view** (sibling
of Explorer / Source Control / Revisão) to browse the vault and launch
ingest/query/lint.

**Chosen over:** FAB-only (management deferred), and FAB + a **rendered query
surface** (option C — a dedicated `/second-brain-query` answer panel).

**Why:** the management surface is the natural "gestão do conhecimento" home the
brief asks for. The integrated query-answer surface is a larger build; query/lint
**launch into the chat** in P1 (the agent already renders answers there), and a
rendered query surface is deferred to P3.

**Consequences:**
- `SidebarView` union gains `'brain'`; `ActionRail` gains a fourth view button;
  `SidebarHost` gains a fourth body slot — the exact pattern M10/M11 used for
  `'scm'`/`'review'`, so `hive.workLayout`/`paneOrder` are untouched.

---

## D-SB-4 — Whisper models: download on demand, `base` first ✅

**Decision:** Ship **no** model in the installer. On the first transcription,
download the default **`base`** model (determinate progress), cache it in
`userData`, and let the user download/switch other models from the UI.

**Chosen over:** embedding `base` in the installer (~140 MB heavier, offline from
first use).

**Why:** keeps a bundle that is already large (≈297 MB, D21) lean; `base` is small
and fetched once. Network is needed **once per model**, then fully offline.

**Consequences:**
- A model store in `userData/whisper-models/<repo>/`; "is downloaded" / download /
  delete are **main-owned** (matches the model-manager UX and the offline renderer).
- Model downloads finalize **atomically** (temp dir → rename) so an interrupted
  download is never mistaken for a complete one.

---

## Derived decisions (design's, consistent with the above)

- **D-SB-5 — Ingestion mechanism = write-to-`raw/` then launch `/second-brain-ingest`.**
  Rather than pasting large content into the chat, ingestion writes the pasted or
  transcribed text to `<ws>/second-brain/raw/<timestamp>.md` (the skill's documented
  inbox) and launches `/second-brain-ingest` via the existing `ChatHandle.launchAction`
  path (the same mechanism the Skill Studio uses, `ui/studioPrompts.ts`). Keeps the
  chat clean and matches the skill's own "clip to `raw/` then ingest" workflow.
- **D-SB-6 — Language default = Portuguese, `task: transcribe`.** The squad works in
  pt-BR (D10); multilingual `base` (not `base.en`) with `language: 'portuguese'`, and
  an "auto/other language" option. English-only `.en` variants are offered but not
  the default.
- **D-SB-7 — Provisioning folds into the existing gate.** Second-brain install/update
  extends the current BMAD provisioning gate (`GuidedInstall`/`UpdateGate` in
  `App.tsx`) as a second step, streaming the same event shape; both are fail-soft.
- **D-SB-8 — Shaped with `impeccable`, validated in the Playwright MCP** (dark+light),
  all copy pt-BR via `t()` — same gates as every prior feature (user rules, verbatim).
- **D-SB-9 — Free to extend/create DS components** for the FAB, recorder, and model
  manager where the design system lacks an adequate primitive (user rule: "a
  experiência é mais importante do que limitações técnicas de components").
