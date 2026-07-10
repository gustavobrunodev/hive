# Context — MVP Vertical Slice

User decisions captured for the gray areas detected during Specify. These are
binding inputs to Design.

---

## C1 — Agent integration strategy (→ R6.2)

**Decision:** Internal `AgentAdapter` interface, **Claude CLI only** in the MVP.

- The "Agent Communication Protocol" requirement is realized as our own decoupled
  adapter boundary in this phase, **not** by adopting an external published ACP spec.
- Devin and other CLIs are future adapters implementing the same contract (M5).
- **Why:** lowest risk, fastest to a working axis, while still keeping the UI fully
  agent-agnostic so the decoupling promise is real from day one.

## C2 — CLI execution model (→ R3.1, R4.1, R6.3)

**Decision:** Spawn processes in the **Electron main** process.

- Main spawns BMAD/agent CLIs (`child_process` and/or `node-pty` where a pty is
  needed for interactive prompts) and streams output to the renderer over IPC.
- The terminal is **abstracted into visual UI** — consistent with "abstract the CLI".
- **Why:** standard, secure Electron pattern; keeps privileged execution out of the
  renderer; lets us translate interactive CLI prompts into native UI.
- **Deferred:** a visible embedded xterm.js terminal as an optional advanced view
  (STATE.md Deferred Ideas).

## C3 — MVP target (→ whole spec)

**Decision:** **Full vertical slice, one workflow.**

- Onboarding (workspace + guided install) → chat with one agent (Claude) → trigger
  one BMAD workflow (**Create a PRD**) → artifact visible in the file explorer.
- **Why:** proves the end-to-end axis before investing in breadth; de-risks the
  hardest integration (BMAD ↔ agent ↔ artifacts) first.

## C4 — Repository location (→ D4)

**Decision:** New top-level directory **`hive-desktop/`** at repo root (not under
`products/`).

## C5 — Model/effort options (→ R6.4)

**Decision:** **Curated per adapter.** Each `AgentAdapter` declares the models and
effort levels it supports; the UI reads the list from the active adapter.

- **Why:** keeps model/effort choice agent-agnostic and correct for the future
  multi-adapter world, without the fragility of scraping `--help` at runtime.
- **Deferred:** dynamic detection from the CLI (STATE.md Deferred Ideas).

## C6 — Workflow catalog (→ R7.3)

**Decision:** **Curated catalog + dynamic fallback.**

- MVP ships a curated map of the key upstream workflows (Domain Research, PRD,
  Brainstorm, Architecture, Story) → BMAD commands, with **Create a PRD** fully
  wired. Read the installed BMAD's workflows dynamically when feasible to extend the
  catalog.
- **Why:** pragmatic — the MVP doesn't depend on fully reverse-engineering BMAD's
  internals, but is built to grow toward full dynamic discovery (M3).

---

## Assumptions to verify before Execute (STATE.md B1)

These come from BMAD's docs not being fully public in the README; **do not code
against them until verified against a real `npx bmad-method install` run:**

- **A1** — Install is `npx bmad-method install` and can be driven into a target dir
  (docs show `--directory <path> --modules <m> --tools claude-code --yes` for
  non-interactive). We may prefer the non-interactive form and render our own guided
  UI around it, OR pty-drive the interactive prompts. Design keeps both open.
- **A2** — BMAD writes a discoverable folder/config into the workspace that we can
  detect to know "is this workspace provisioned?" (exact path TBD).
- **A3** — There is an update path for an existing install (README references an
  upgrade-to-v6 guide; exact command TBD).
- **A4** — A PRD-producing workflow exists and writes a file to a known location in
  the workspace (exact command + output path TBD).

**Action (owner: implementer, before M1 Execute):** run a throwaway install,
record prompts / folder layout / config path / workflow command / artifact path,
then update design.md "BMAD Integration" and clear B1.
