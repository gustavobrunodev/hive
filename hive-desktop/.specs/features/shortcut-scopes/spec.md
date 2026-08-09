# Spec — `shortcut-scopes` (M16)

Two user requests, one shape: **the role is a first-run setting**, and
**shortcuts are two sets, not one**.

## Problem

Role-personalization (M9) made the role pick both a one-time onboarding step
*and* an editable control in the profile sheet. Shortcut-customization then made
one selection serve two very different moments — the "O que você quer fazer
hoje?" hero and the strip docked above the composer mid-conversation. Both
choices aged badly:

- **The role became a live control over something derived.** Re-picking it in
  the sheet silently rewrote the shortcut set the user had been working with. A
  setting that decides your defaults is a *first-run* decision; offering it
  again invites a change whose consequence isn't visible from where it's made.
- **One set for two moments is wrong in both directions.** The hero wants a
  broad menu — that's how a conversation starts. The strip is chrome over a live
  conversation, where the same seven launchers are noise. Making them one list
  forced the user to choose which of the two surfaces to get wrong.

## Requirements

- **SS-R1 — The role is chosen once.** `RoleSetup` (first run) stays exactly as
  it is. The profile sheet shows the active role as **read-only context** —
  icon, name, focus line, and a sentence saying where it was decided — with no
  affordance to change it. No `setRole` path exists outside onboarding.
- **SS-R2 — Two independent shortcut sets.**
  - `start` — the hero, before the first message. Defaults: the existing
    per-role catalog, unchanged.
  - `during` — the strip above the composer, inside a live conversation.
    Defaults: **PM → `bmad-party-mode`**; every other role (and the internal
    `general` fallback) → **empty**.
- **SS-R3 — Each set is customized and restored on its own.** Editing one never
  writes the other; "Restaurar padrão" drops the *visible* set's customization
  only, and the "Padrão do papel"/"Personalizado" badge reports the visible set.
- **SS-R4 — The picker is reachable from the profile sheet**, in addition to the
  hero pill and the strip control.
- **SS-R5 — An empty `during` set renders no strip at all** — not even the
  customize control. Most roles ship none, and a permanent "configure me"
  affordance over every conversation is chrome advertising itself.

## Decisions (gray areas resolved during the build)

- **(a) `Config.shortcuts` becomes `{ start, during }`, migrated on read.** The
  pre-split flat `{ skills, agents }` was the *hero* selection (mirrored into
  the strip), so it lifts into `start` and `during` starts from the role
  default. Handled in `sanitizeShortcutSettings`, so a hand-edited or older
  config can never reach the resolver malformed.
- **(b) One IPC round trip, two sets.** `shortcuts:actions` returns
  `{ start, during }` rather than taking a scope: the hero and the strip always
  render together, so resolving them together means they can't disagree.
  `shortcuts:set` *is* scoped (`set(scope, prefs)`) and drops an unrecognized
  scope instead of defaulting — writing the wrong set is worse than writing
  none.
- **(c) The picker gets a live preview, not a longer explanation.** Two
  independent sets is one concept more than a picker usually carries. A
  `SegmentedControl` (DS, with per-scope counts) switches sets; under it, a
  miniature of the surface the active set lands on — the real `.wb-pill` /
  `.wb-shortcut-chip` classes over a stand-in composer, centered for the hero
  and docked-left for the strip. The empty state is part of the teaching: "a
  barra acima do campo de mensagem some."
- **(d) Opening the picker from the profile sheet closes the sheet.** A dialog
  stacked on a sheet traps focus twice, and the picker's second preview *is* the
  live hero/strip behind it — which a sheet would cover.
- **(e) The Skill Studio pins into `start`.** A creation belongs where a
  conversation begins; the in-conversation set stays a deliberate, hand-picked
  row. The pin's accessible name says which set it changes.

## What shipped

**Main** — `configStore` (`ShortcutScope`, `ShortcutSettings`,
`sanitizeShortcutSettings` + legacy migration, per-scope `setShortcuts`),
`roleCatalog` (`RoleDef.conversation`, scoped `resolveRoleActions` /
`resolveShortcuts`, `resolveAllShortcuts`), three reshaped IPC handlers.

**Renderer** — `ShortcutCustomizer` rebuilt around the scope switch + live
preview; `ProfileSheet` role block made read-only and a "Seus atalhos" section
added (per-set counts + "Configurar atalhos"); `Chat` split into
`startActions` / `conversationActions`; `WorkUI` holds both sets and the
picker's initial scope; `App` no longer carries an `onRoleChange`.
New `PartyModeIcon`; `party-mode` wired through `roleVisuals` + the pt-BR maps.

**Gates** — `npm run verify` green (2499 tests / 157 files). New E2E:
`e2e/contrast.spec.ts` sweeps the picker (both scopes) and the profile sheet in
all three themes. New visual driver: `tools/visual/shortcuts-pass.mjs`.

## Non-goals

- Reordering shortcuts inside a set (selection order is still append order).
- A third scope, or per-workspace sets (prefs stay global, as before).
- Changing the role catalog's `start` defaults.
