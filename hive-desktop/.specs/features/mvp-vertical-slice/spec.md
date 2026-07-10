# Feature: MVP — Vertical Slice

**Milestone:** M1
**Scope:** Complex (new domain, multi-component, ambiguity) → full pipeline
(Specify → Design → Tasks → Execute) with interactive UAT.

## Summary

The thinnest end-to-end path that proves Hive Desktop's thesis: a non-terminal
user picks a workspace, is guided through a visual BMAD install, chats with an
agent (Claude CLI), clicks "Create a PRD", and watches the resulting `PRD.md`
appear in an in-app file explorer. On the next launch, the app auto-updates BMAD
and opens straight into the remembered workspace.

This slice deliberately includes **one** of each pillar (one agent, one workflow,
read-only explorer) so the full axis is real before breadth is added in M2–M5.

---

## Requirements

Legend: **[M]** must-have for MVP · **[S]** should-have · **[D]** deferred to later
milestone (listed for traceability, not built here).

### R1 — App Shell & Foundations

- **R1.1 [M]** The app is an Electron desktop application with a React + TypeScript
  renderer.
- **R1.2 [M]** The renderer is styled exclusively with `@hive/design-system`
  components and tokens (product register). No ad-hoc component reinvention when a
  DS component exists.
- **R1.3 [M]** Renderer runs with `contextIsolation: true` and
  `nodeIntegration: false`; all privileged operations (fs, process spawn) go through
  a typed IPC bridge exposed via `contextBridge`.
- **R1.4 [M]** The app supports the DS dark and light themes.
- **R1.5 [M]** All user-facing surfaces are shaped following the `impeccable` skill
  (hierarchy, states, a11y, copy).
- **R1.6 [M]** **The entire interface is in Brazilian Portuguese (pt-BR).** All
  user-facing copy — labels, buttons, placeholders, intent prompts, empty/loading/
  error states, tooltips, notifications, and onboarding text — is written in pt-BR.
  UI strings are not hardcoded inline; they live in a single centralized strings
  module so copy stays consistent and a future locale can be added without touching
  components. Copy authored/reviewed under the `impeccable` skill (R1.5) is written
  in pt-BR. Note: content produced by BMAD/agents (artifacts, agent replies) is
  driven by the agent/workflow, not by this requirement.

### R2 — Workspace Selection & Persistence

- **R2.1 [M]** On first run, the user is prompted to choose a workspace folder via a
  native directory picker.
- **R2.2 [M]** The chosen workspace path is persisted locally.
- **R2.3 [M]** On subsequent launches, the app opens the persisted workspace by
  default without re-prompting.
- **R2.4 [S]** The user can switch to a different workspace from within the app.

### R3 — Guided BMAD Install (first run)

- **R3.1 [M]** On first run, after workspace selection, the app runs the BMAD
  installation **into the selected workspace** by spawning the BMAD CLI from the
  Electron main process.
- **R3.2 [M]** The install is presented as a **visual, guided flow** — the user
  never types a terminal command. CLI interactive prompts are surfaced as native UI
  (steps, choices, progress).
- **R3.3 [M]** Live install progress and the final success/failure state are shown
  visually, sourced from the real underlying process output.
- **R3.4 [M]** On install failure, a clear error state with a retry path is shown
  (no silent failure, no raw stack dumped as the primary message).
- **R3.5 [M]** After a successful install, the app records that the workspace is
  BMAD-provisioned so it does not re-run first-run install.

### R4 — Auto-Update BMAD (subsequent runs)

- **R4.1 [M]** On every launch **after** first-run provisioning, the app updates
  BMAD in the workspace **before** presenting the work interface.
- **R4.2 [M]** The update runs with a visible progress state; the work UI is gated
  until it completes (or the user is offered to continue on failure).
- **R4.3 [S]** If already up to date, the update step resolves quickly without
  noise.

### R5 — Workspace File Explorer / Viewer

- **R5.1 [M]** A file tree shows the folder structure of the current workspace
  (using the DS `Tree` component).
- **R5.2 [M]** Selecting a file opens a viewer showing its contents.
- **R5.3 [M]** Markdown artifacts (e.g. `PRD.md`) are viewable in a readable form;
  code/text files render in a code viewer (DS `CodeBlock`).
- **R5.4 [M]** The explorer reflects files newly created by an agent workflow
  (refresh on change or on demand) so a produced artifact becomes visible.
- **R5.5 [D]** In-place editing/saving of files → M4.

### R6 — Agent Chat (Claude CLI adapter)

- **R6.1 [M]** A chat surface lets the user converse with an agent, rendered as a
  visual conversation (DS `MessageList` / `ChatMessage` / `PromptInput` /
  `TypingIndicator`), **not** a raw terminal.
- **R6.2 [M]** Agent access is behind an `AgentAdapter` interface; the MVP ships a
  **Claude CLI** adapter as the only implementation. No Claude-specific detail
  leaks into UI components.
- **R6.3 [M]** The Claude CLI runs as a spawned process in Electron main; its
  output is streamed to the chat over IPC.
- **R6.4 [M]** The chat exposes **model selection** and **effort selection**, with
  options **declared by the active adapter** (not hardcoded in the UI).
- **R6.5 [S]** File attachment into the agent context.
- **R6.6 [D]** MCP usage → M2.
- **R6.7 [D]** Conversation history persistence → M2.
- **R6.8 [D]** Session resume → M2.

### R7 — Guided Intent → BMAD Workflow

- **R7.1 [M]** On entering a **new session**, the chat shows intent placeholders
  ("What do you want to do today?"): at minimum **Create a PRD** (the MVP workflow),
  plus visible-but-secondary entries for Domain Research, Brainstorm, Architecture,
  Story.
- **R7.2 [M]** Clicking **Create a PRD** automatically triggers the corresponding
  BMAD workflow through the agent adapter — the user does not have to know the BMAD
  command.
- **R7.3 [M]** The workflow→command mapping comes from a **curated catalog**, with
  dynamic discovery from the installed BMAD as a fallback where feasible.
- **R7.4 [M]** Running the "Create a PRD" workflow to completion produces a PRD
  artifact in the workspace that then satisfies R5.4 (visible in explorer).
- **R7.5 [D]** All other placeholders fully wired → M3.

### R8 — End-to-End Acceptance

- **R8.1 [M]** A user who has never used a terminal can, in one session: choose a
  workspace → complete guided BMAD install → open a new chat → click "Create a PRD"
  → see `PRD.md` appear in the explorer and open it.
- **R8.2 [M]** Re-launching the app opens the remembered workspace and updates BMAD
  before showing the work UI, with no re-onboarding.

---

## Acceptance Criteria (demoable)

1. Fresh machine, first launch → workspace picker → guided install completes
   visually → work UI appears. **(R2, R3)**
2. New chat shows intent placeholders; "Create a PRD" launches the workflow via the
   Claude adapter with a chosen model/effort. **(R6, R7)**
3. `PRD.md` (or BMAD's actual PRD output) appears in the file tree and opens in the
   viewer. **(R5, R7.4)**
4. Quit and relaunch → no picker, no re-install; BMAD auto-updates with visible
   progress, then the remembered workspace opens. **(R2.3, R4)**
5. Renderer has no direct fs/process access (verified: `nodeIntegration:false`,
   `contextIsolation:true`; all privileged calls via preload bridge). **(R1.3)**
6. Every screen in the demo (picker, guided install, chat, intent placeholders,
   explorer, error/empty states) reads in Brazilian Portuguese; no leftover English
   UI strings. **(R1.6)**

## Out of Scope (this feature)

- Multiple agents/adapters, MCP, history, resume, in-place editing, full workflow
  catalog, app self-update, signed installers. (Tracked in ROADMAP M2–M6.)

## Open Questions → resolved in context.md / flagged in STATE.md B1

- Exact BMAD install prompts, folder layout, workflow commands, and artifact paths
  must be verified against a real install before Execute (STATE.md **B1**).
