# Feature: Role Personalization & Profile

**Milestone:** M9 (Personalization) — new
**Status:** 📝 Planned (2026-07-13)

Make the app adapt to *who the user is*. The user declares a **role** (Product
Manager, Tech Lead, UX Designer, QA, Developer); from that, the app curates the
actions it foregrounds — the "O que você quer fazer hoje?" intents, an
always-available **left action rail**, and a one-click "talk to the BMAD
specialist for my role" — and exposes a **profile/settings gear** to change role
(and agent) anytime.

---

## Problem

The intent grid shows the same five generic placeholders to everyone, and the
BMAD upstream lifecycle is role-shaped (a PM lives in PRDs/briefs/research; a
Tech Lead in architecture/stories; UX in UX specs; QA in test design/automation).
Today there is no notion of the user, no way to foreground the *right* workflows,
and the guided intents only appear on an empty conversation (once you've sent one
message, they vanish — the shortcuts have no permanent home).

## Solution

- A **Role** model persisted globally; a **required** first-run step to choose it.
- A **role → action catalog**: each role maps to a curated ordered set of actions
  — BMAD workflows plus a "Conversar com <persona>" action bound to that role's
  BMAD specialist agent (John=PM, Winston=Architect, Sally=UX, Murat=QA,
  Amelia=Dev).
- The **intent grid** ("O que você quer fazer hoje?") renders the current role's
  actions, all launchable.
- A **persistent left action rail**: the same role actions, one click away at any
  time (not just on an empty conversation) + a gear.
- A **profile/settings surface** (opened by the gear) to change role and agent.

---

## Roles → Actions (source of truth)

Each action is `(labelKey, BMAD skill, kind)`. `kind: workflow` launches a BMAD
skill workflow; `kind: persona` opens a conversation with that role's specialist
agent. Skill names are the **live, non-deprecated** BMAD skills present in the
install (verified against the skills catalog):

| Role | Actions (ordered) |
|------|-------------------|
| **Product Manager** (John) | Domain Research (`bmad-domain-research`) · Brainstorming (`bmad-brainstorming`) · PRD (`bmad-prd`) · Product Brief (`bmad-product-brief`) · Épicos & Histórias (`bmad-create-epics-and-stories`) · Criar história (`bmad-create-story`) · **Conversar com John** (`bmad-agent-pm`, persona) |
| **Tech Lead** (Winston) | Arquitetura (`bmad-architecture`) · Épicos & Histórias (`bmad-create-epics-and-stories`) · Criar história (`bmad-create-story`) · **Conversar com Winston** (`bmad-agent-architect`, persona) |
| **UX Designer** (Sally) | Especificação de UX (`bmad-ux`) · **Conversar com Sally** (`bmad-agent-ux-designer`, persona) |
| **QA** (Murat) | Cenários de teste (`bmad-testarch-test-design`) · Automação de testes (`bmad-testarch-automate`) · **Conversar com Murat** (`bmad-tea`, persona) |
| **Developer** (Amelia) | Implementar história (`bmad-dev-story`) · Revisão de código (`bmad-code-review`) · **Conversar com Amelia** (`bmad-agent-dev`, persona) |

A **General** fallback role (used if a user picks "decidir depois" is NOT
offered — the step is required — but General remains the internal default before
a role is ever set) shows the original curated five.

---

## Requirements

### RP-R1 — Role model & persistence
- **RP-R1.1** A closed set of roles: `pm | tech-lead | ux | qa | dev`
  (+ internal `general` default). Persisted **globally** in `ConfigStore`
  (`role`), restored on launch.
- **RP-R1.2** Each role has an i18n display name, a short descriptor, and an icon.

### RP-R2 — Required first-run role step
- **RP-R2.1** On first run (no role set), after the agent step, a **required**
  role-selection screen is shown; the user cannot reach the work UI without
  choosing. Beautiful, modern, card-based (impeccable).
- **RP-R2.2** Once a role is set, later launches skip the step.

### RP-R3 — Role → action catalog
- **RP-R3.1** A catalog maps each role to its ordered actions per the table above.
  Every action is launchable (workflows resolve a real BMAD skill prompt; personas
  open the specialist agent) — no permanently "planned/disabled" role actions.
- **RP-R3.2** Action launching reuses `agent.runWorkflow` (same turn semantics as
  today's wired PRD intent); personas send a natural-language prompt that resolves
  the role's `bmad-agent-*` / `bmad-tea` skill.
- **RP-R3.3** All action labels are pt-BR chrome copy via `t()`.

### RP-R4 — Personalized intent grid
- **RP-R4.1** The "O que você quer fazer hoje?" hero renders the current role's
  actions (replacing the generic five), with the persona action visually distinct
  ("Conversar com <persona>").
- **RP-R4.2** The greeting/subtitle reflects the role (e.g. addresses the user's
  focus) without hardcoding a name.

### RP-R5 — Persistent left action rail
- **RP-R5.1** A slim, always-visible left rail lists the current role's actions as
  icon buttons (tooltip labels), available at any time — including mid-conversation
  — launching the same actions as the intent grid.
- **RP-R5.2** The rail includes a **gear** entry opening the profile/settings
  surface (RP-R6), and is keyboard-accessible with visible focus.
- **RP-R5.3** The rail collapses gracefully on narrow widths (icons only; never
  breaks the 3-pane body layout).

### RP-R6 — Profile / settings surface (the gear)
- **RP-R6.1** A gear opens a profile surface (dialog or sheet) showing the current
  role and agent, each changeable.
- **RP-R6.2** Changing the role updates the intent grid + action rail live (no
  relaunch); changing the agent re-binds the session (AG-R3.2).
- **RP-R6.3** The surface states the profile is app-wide (global).

### RP-R7 — Quality gates
- **RP-R7.1** No regression (test/typecheck/lint), ≥90% per-file coverage on
  changed files, all copy via `t()` (pt-BR), visual pass via `_electron.launch`.
- **RP-R7.2** The design is shaped with the `impeccable` skill (D3): visual
  hierarchy, motion, empty/hover/focus states, theming (dark+light), responsive.

---

## Non-Goals
- Multiple simultaneous roles / role blending. One active role at a time.
- Per-workspace roles (global only, per the profile-scope decision).
- Editing the role→action catalog from the UI (curated in code for v1).
- Downstream implementation beyond the Developer role's two starter actions;
  full dev/QA execution workflows remain later-milestone scope.
