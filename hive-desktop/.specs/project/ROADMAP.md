# Roadmap — Hive Desktop

Milestones are ordered by dependency. The **MVP is a vertical slice** that proves
the end-to-end axis; breadth comes after the axis is proven.

---

## M0 — Foundations (app shell)

Electron + React scaffold, TypeScript, `@hive/design-system` wired in, secure IPC
baseline (contextIsolation, no nodeIntegration in renderer), theming (dark/light
from DS), packaging able to launch.

**Exit criteria:** app launches on the dev machine, renders a DS-styled shell,
main↔renderer IPC round-trips.

---

## M1 — MVP: Vertical Slice ⭐ (current focus)

**Feature:** `mvp-vertical-slice`

The thinnest end-to-end path that proves the product thesis:

1. **First-run onboarding** — pick a workspace → guided visual BMAD install into it.
2. **Workspace file explorer** — browse/open/view files of the chosen workspace.
3. **Agent chat (Claude CLI adapter)** — one working agent, streamed into a
   visual chat (not a raw terminal).
4. **One workflow, guided** — new-session placeholder "Create a PRD" launches the
   corresponding BMAD workflow through the agent.
5. **Artifact in context** — the produced PRD appears in the file explorer and
   is viewable in the app.
6. **Auto-update on subsequent launch** — BMAD is updated before showing the
   workspace (workspace remembered from first run).

**Exit criteria:** a user with no terminal knowledge installs BMAD, asks the agent
to create a PRD, and sees `PRD.md` appear in the explorer — all inside the app.

---

## M2 — Chat completeness

Model selection, effort selection, file attachments into context, MCP usage,
conversation history, session resume. All surfaced through the agent-adapter
capability contract so they stay agent-agnostic.

## M3 — Full workflow catalog

All upstream placeholders (Domain Research, PRD, Brainstorm, Architecture, Story)
wired to BMAD workflows; dynamic discovery of installed BMAD workflows as fallback
to the curated catalog.

## M4 — File editing

Promote the read-only viewer to a real editor (edit/save artifacts in place),
with awareness of concurrent agent writes.

## M5 — Second agent adapter

Add a second agent CLI (e.g. Devin) to prove the decoupling from M1 in practice.

## M6 — Polish & packaging

Impeccable-driven UX pass, error/empty/loading states hardened, signed installers
for distribution, auto-update of the app itself.

---

## Dependency Graph

```
M0 ──► M1 (MVP) ──► M2 ──► M4
                 └─► M3
                 └─► M5
                 M2+M3+M4+M5 ──► M6
```

M2, M3, M5 can proceed in parallel after M1. M6 gates release.
