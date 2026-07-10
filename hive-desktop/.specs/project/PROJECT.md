# Hive Desktop

## Vision

A desktop application for **Squad members** (PMs, Tech Leads, Analysts, UX) to
orchestrate **BMAD** agentic workflows through natural-language chat with AI
agents — managing the entire **upstream artifact lifecycle** of a Squad (Domain
Research, PRD, Architecture Document, Stories, and more) without ever touching a
terminal.

BMAD is the **heart** of the product. Hive Desktop is the visual, guided,
squad-friendly surface over BMAD's CLI-driven agile-AI framework.

## Problem

BMAD (`bmad-method`) is a powerful CLI-first framework, but its power is gated
behind terminal fluency: `npx` installs, interactive CLI prompts, manually
invoking 34+ workflows, and juggling different coding-agent CLIs (Claude, Devin,
etc.). Non-engineering squad members can't adopt it, and even engineers lose flow
context-switching between the terminal, their editor, and the produced artifacts.

## Solution

An **Electron + React** desktop app that:

1. **Abstracts the BMAD CLI** — guided visual install/update, no terminal
   required.
2. **Chats with any agent** — a decoupled agent layer (starting with Claude CLI)
   lets users converse with an agent that drives BMAD workflows.
3. **Manages workspace artifacts** — an integrated file explorer/editor shows the
   PRDs, architecture docs, and stories the agent produces, in place.
4. **Guides intent** — new-session placeholders ("Create a PRD", "Brainstorm",
   "Domain Research"…) launch the matching BMAD workflow on click.

## Target Users

- **Product Managers** — draft PRDs, run brainstorming and domain research.
- **Tech Leads / Architects** — produce architecture documents, break down stories.
- **Analysts / UX** — contribute upstream artifacts within the same guided surface.

All are BMAD-curious but not necessarily CLI-fluent. The product's job is to make
BMAD feel like a native app, not a wrapped terminal.

## Goals

- **G1 — Zero-terminal BMAD.** A user installs, updates, and runs BMAD workflows
  without ever opening a terminal or typing a CLI command.
- **G2 — Agent-agnostic.** The chat layer is decoupled behind an adapter so any
  agent CLI (Claude today, Devin/others later) can be plugged in without touching
  the UI.
- **G3 — Artifacts in context.** Every artifact BMAD produces is visible and
  editable inside the app, in the user's chosen workspace.
- **G4 — Guided intent.** The user is guided from "what do I want to do today?"
  straight into the correct BMAD workflow.
- **G5 — Impeccable UX.** The interface is built on `@hive/design-system` and
  shaped with the `impeccable` skill — it must feel like a first-party Hive
  product, not a wrapper.

## Non-Goals (v1)

- Downstream/implementation workflows (dev, QA) — v1 is **upstream artifacts** only.
- Multi-user / real-time collaboration.
- Cloud sync — v1 operates on the local workspace.
- Building our own agent/LLM — we orchestrate existing agent CLIs.

## Guiding Principles

- **BMAD is the source of truth.** We orchestrate BMAD; we do not reimplement it.
  When BMAD changes, we adapt the adapter, not the domain.
- **Decouple the agent.** Never hardcode Claude specifics into the UI; route
  everything through the agent adapter interface.
- **One brand, product register.** Reuse `@hive/design-system` (Zup brand) tokens
  and components; this is a product-register surface (utility UI), not a marketing one.
- **Abstract the CLI, don't hide the truth.** Visual flows replace terminal
  interaction, but surface real progress/errors from the underlying processes.

## Ecosystem Context

Part of the **hive** monorepo alongside `@hive/design-system` and
`products/harness-builder`. Hive Desktop lives at repo root in `hive-desktop/`
and consumes `@hive/design-system` as its component library.

## Reference

- BMAD Method (official): https://github.com/bmad-code-org/bmad-method
- BMAD docs: https://docs.bmad-method.org
