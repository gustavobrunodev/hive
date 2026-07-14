# Design — Role Personalization & Profile

Applies the `impeccable` **product register** (design SERVES the task): restrained
color (one accent — the DS `--accent`), full semantic state vocabulary
(default/hover/focus/active/selected/disabled), familiar affordances, 150–250ms
state-conveying motion, empty/loading states that teach. Reuses the app's `.wb-*`
chrome vocabulary and `@hive/design-system` tokens; extends where the UX wins
(C7). Dark + light both first-class (byte-parity token system already in place).

---

## 1. Data model & catalog (main + shared)

### Role type (`src/main/roleCatalog.ts` — new)
```ts
export type RoleId = 'pm' | 'tech-lead' | 'ux' | 'qa' | 'dev' | 'general'

export interface RoleActionDef {
  key: string                 // stable action key (i18n label + icon lookup)
  skill: string               // BMAD skill invoked
  kind: 'workflow' | 'persona'
}
export interface RoleDef {
  id: RoleId
  personaSkill?: string       // the role's bmad-agent-* / bmad-tea (for the persona action)
  actions: RoleActionDef[]    // ordered
}
```
`ROLE_CATALOG: Record<RoleId, RoleDef>` encodes the spec's Roles→Actions table.
Skill names are the verified live ones (RP-C4/C5). `general` = the original
curated five (back-compat for the pre-role default only).

`actionPrompt(action)` builds the natural-language turn:
- `workflow` → `"Use the <skill> skill to <intent>."` (per-skill Portuguese/EN
  phrasing lives with the catalog, mirroring workflowCatalog's `prd` prompt).
- `persona` → `"Quero conversar com <PersonaName> (<role label>)."` — resolves the
  `bmad-agent-*`/`bmad-tea` SKILL.md by description (B1/B2 model).

The catalog returns `WorkflowCommand { key, prompt }` objects so launching reuses
the **existing** `agent.runWorkflow` path end-to-end (no new agent plumbing).

### Config (`configStore.ts`)
Add `role: RoleId | null` (default `null` = "not chosen yet") to `Config` +
`DEFAULT_CONFIG`; add `setRole(id)` / `getRole()`. Global scope (RP-C1). Same
atomic-write path as existing fields.

### IPC (`preload` + `main/index.ts`)
Add under a `profile` namespace (new; parallels `agent`/`workflows`):
- `profile.getRole(): Promise<RoleId | null>`
- `profile.setRole(id: RoleId): Promise<void>`
- `profile.roleActions(role): Promise<RoleAction[]>` — resolved actions
  (key + kind + `WorkflowCommand`) for the renderer to render + launch. Keeping
  resolution in main means the renderer never imports the skill catalog, and the
  labels stay in the renderer i18n keyed by `action.key`.

(Agent selection adds `profile.getAgent`/`setAgent`/`agents` — see
agent-selection design; both live in the one `profile` namespace.)

---

## 2. Onboarding: the required role step

New `App.tsx` onboarding states inserted **once, globally** (RP-C6 order):
`picker → (setupAgent) → (setupRole) → checkingProvisioned → install/update → ready`.
Gate logic: after a workspace is known, if `getAgent()`/`getRole()` are unset,
route through the setup steps first; if already set (returning user / workspace
switch), skip straight to `checkingProvisioned`. So the steps are truly one-time,
never re-shown on a workspace switch.

### `RoleSetup.tsx` (new onboarding screen)
Built on the existing `.wb-gate` centered-gate shell (same as `WorkspacePicker`/
`GuidedInstall`), so it feels like one onboarding system.

Layout: brand mark → title (`t('roleSetup.title')`, e.g. "Qual é o seu papel?") →
one-line sub → a **role-card radiogroup** → primary CTA "Continuar" (disabled
until a card is selected — required, RP-R2.1).

**Role card** (`RoleCard`, app-level presentational component):
- A `role="radio"` selectable card (NOT the banned identical-icon-grid — these are
  a genuine single-select affordance with distinct content per card).
- Content: role icon (distinct per role) · role name · one-line "what you'll do"
  descriptor · a muted mini-list of its top 3 action labels (teaches what
  selecting does — an empty-state-that-teaches principle applied to choice).
- States: default (surface + `--border`), hover (`--surface-2`, border-strong),
  **selected** (`--selected-bg` tint + `--accent` border + a check affordance),
  focus-visible (`inset 2px var(--focus)` — the SkillCard lesson), disabled n/a.
- Grid: `repeat(auto-fit, minmax(240px, 1fr))`, `--s-3` gap — 5 roles wrap 3+2 on
  wide, 1-col on narrow. No fixed breakpoints needed.
- Motion: selected border/tint transition 160ms `--ease-quart`; staggered card
  entrance (each card fades+rises 8px, 40ms stagger) — a legitimate list stagger,
  reduced-motion → instant.

Selecting a card + Continuar calls `profile.setRole(id)` then advances the gate.

---

## 3. Personalized intent grid (`IntentGrid.tsx` + `Chat.tsx`)

`Chat` loads the role's resolved actions (`profile.roleActions(role)`) instead of
`workflows.list(workspace)` for the hero. `IntentGrid` renders them:
- All actions are **live** now (no `planned` disabled row for role actions). The
  generic `wired`/`planned` split is retained only for the `general` fallback.
- **Persona action** is visually distinct: rendered last, as a wider "conversation"
  pill with the persona avatar/mark + "Conversar com <persona>" — an accent-tinted
  variant (`data-persona="true"`) so "talk to your specialist" reads as the warm,
  human entry point, not just another workflow chip.
- Greeting: `t('intentGrid.roleTitle', roleLabel)` addresses the role's focus
  without hardcoding a name (RP-R4.2).

Icons: extend `intentIconFor` with the new action keys (research/brainstorm/prd/
brief/epics/story/architecture/ux/test-design/test-automation/dev-story/
code-review/persona-*). New icons added to `ui/icons.tsx` in the DS line style.

---

## 4. Persistent left action rail (`ActionRail.tsx` — new)

The "second home" (RP-C3, user-chosen). A **fixed chrome column** on the far left
of `.wb-body`, OUTSIDE the resizable rail/chat/viewer group — so it never disturbs
the persisted `hive.workLayout` split.

```
.wb-app
 ├─ .wb-topbar            (unchanged)
 └─ .wb-shell  (new flex row)
     ├─ .wb-actionrail    (NEW — fixed ~56px column)
     └─ .wb-body          (existing Resizable group, unchanged internally)
```

`ActionRail`:
- Vertical stack of icon buttons (reusing the `.wb-icon-btn` vocabulary → one
  consistent button shape across the app, per product register). Each = one role
  action; `title`/`aria-label` from i18n; DS `Tooltip` on hover for the label.
- The **persona** action sits in its own slot (a subtle divider above it) with an
  accent-tinted treatment, matching the intent grid's persona distinction.
- Bottom-anchored **gear** button opens the profile sheet (RP-R5.2), visually
  separated by `margin-top:auto` + a hairline.
- Active/pressed feedback on launch (a brief `:active` depress); a launched action
  flashes a 1-frame accent pulse so the click registers even though the result
  appears in chat.
- Focus order: top-to-bottom, all keyboard reachable, `:focus-visible` ring.
- Narrow-width: the column is already icon-only (~56px), so it survives small
  windows; below a hard min it can be `overflow-y:auto` scrolled (RP-R5.3). Never
  wraps into the body.

Launching a rail action = the same `runWorkflow` turn as the intent grid; if the
chat is showing the hero (empty), the action also seeds the first message. Rail
and grid share one `launchAction(action)` handler lifted into `Chat`/`WorkUI`.

Design intent (impeccable): the rail is *quiet* — icon-only, `--faint`/`--muted`
resting ink, accent only on hover/active/persona — so it's an always-there tool
that recedes until used, not a loud second navbar. This is the product-register
"second neutral layer for toolbars" done right.

---

## 5. Profile / settings sheet (`ProfileSheet.tsx` — new)

Opened by the rail gear (and could be opened elsewhere later). Uses the DS
`Sheet` (right-side panel) — a settings surface is a legitimate non-modal-first
choice; a side sheet keeps the work context visible behind it (better than a
center Dialog for settings, per product register's "exhaust inline/progressive
alternatives").

Sections:
1. **Papel** — the current role + a compact role selector (same `RoleCard`
   group, or a `RadioGroup` in-sheet). Changing it calls `profile.setRole` and
   the change propagates live (RP-R6.2) via a lifted `role` state in `App`/`WorkUI`
   → intent grid + rail re-render. No relaunch.
2. **Agente** — the agent selector (agent-selection RP-R6/AG-R3.2); changing
   re-binds the session.
3. A one-line note: "Seu perfil vale para todos os workspaces." (RP-R6.3).

State plumbing: `role` (and `agent`) are lifted to `App.tsx` (loaded once post-
onboarding, passed to `WorkUI` → `ActionRail`/`Chat`/`ProfileSheet`). A change in
the sheet updates that state and persists; children re-render. This avoids each
component independently re-reading config.

---

## 6. Component/ownership map

| Concern | Where | New/changed |
|---|---|---|
| Role type + catalog + prompts | `main/roleCatalog.ts` | new |
| Config `role` | `main/configStore.ts` | changed |
| IPC `profile.*` | `main/index.ts`, `preload/index.ts` | changed |
| Role setup screen | `renderer/onboarding/RoleSetup.tsx` | new |
| Role card | `renderer/ui/RoleCard.tsx` | new |
| Onboarding gate order | `renderer/App.tsx` | changed |
| Personalized hero | `renderer/chat/IntentGrid.tsx`, `chat/Chat.tsx` | changed |
| Action rail | `renderer/WorkUI.tsx` + `renderer/ui/ActionRail.tsx` | new/changed |
| Profile sheet | `renderer/ui/ProfileSheet.tsx` | new |
| Icons | `renderer/ui/icons.tsx` | changed |
| Copy | `renderer/i18n/pt-BR.ts` | changed |
| Styles | `renderer/assets/workbench.css` | changed |

---

## 7. Accessibility, i18n, testing

- Radiogroup semantics on role cards (`role="radiogroup"`/`radio`, arrow-key
  roving); rail buttons are real `<button>`s with labels; sheet is DS `Sheet`
  (focus-trapped, Esc-close, labelled).
- All copy via `t()` (RP-R3.3 / D10); action labels keyed by `action.key`.
- Unit/component tests: config `role` round-trip; `roleCatalog` resolves each
  role's actions + prompts; `App` routes through the required role step when
  unset and skips when set; `IntentGrid` renders role actions incl. persona
  distinction; `ActionRail` launches actions + opens sheet; `ProfileSheet`
  changes role/agent live. ≥90% per-file (RP-R7.1).
- Visual: `_electron.launch` screenshots of the role step (dark+light), the
  personalized hero, the rail (resting + hover + persona), and the profile sheet
  — the repo's working Electron-native Playwright path (STATE.md T14).

## 8. Risks
- **Rail vs. layout**: keeping the rail outside the Resizable group is essential
  (a panel inside it would corrupt the persisted `hive.workLayout`). Verified by
  the `.wb-shell` wrapper approach.
- **Live role change**: lifting `role` to `App` avoids stale reads; the hero and
  rail are pure functions of it.
- **Skill availability**: role actions assume `bmm` installed (RP-C5) — always
  true given the install catalog's `bmm` is `recommended`/core. If a workspace
  somehow lacks a skill, the turn degrades to the adapter's generic fallback
  (no crash).
