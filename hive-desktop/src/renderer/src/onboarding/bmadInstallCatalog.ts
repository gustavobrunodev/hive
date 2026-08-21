/**
 * Curated catalog backing the guided install form (BUG 1,
 * InstallConfigForm.tsx). This is *data*, not UI chrome — it lives in a `.ts`
 * module (like main/workflowCatalog.ts) rather than being inlined into the
 * form's JSX, so its labels/descriptions are rendered as `{item.label}`
 * expressions and don't trip the no-inline-string guard (i18n/noInlineStrings.test.ts).
 *
 * The module list is curated (context.md C: "curated + dynamic fallback"):
 * `bmad-method` has no non-interactive command that lists the full official
 * module set (that list is fetched live inside the interactive TUI), so the
 * recommended, code-confirmed modules are hand-maintained here. Codes were
 * confirmed against `bmad-method install --list-options`. `core` is always
 * installed by the CLI and is intentionally not listed as a togglable option.
 *
 * **`id` is the wire, `label` is the product.** The ids below are the exact
 * `--modules` codes the CLI expects and must never be localized or renamed.
 * The labels are ours, and they name what the user *gets* — "Método de
 * produto", not "BMad Method". Someone on their first run has no idea what
 * BMad is, and a checklist of unexplained product names is a checklist nobody
 * can make an informed choice from. The engine's name belongs in the code and
 * in the docs, not in the one screen that has to earn a stranger's trust.
 */

export interface BmadModuleOption {
  /** `--modules` id, e.g. `bmm`. Wire format — never localized. */
  id: string
  label: string
  description: string
  /** Pre-checked when the form first renders. */
  recommended?: boolean
}

export const BMAD_MODULE_CATALOG: readonly BmadModuleOption[] = [
  {
    id: 'bmm',
    label: 'Método de produto',
    description:
      'Fluxos de PM, arquiteto, dev e UX — o essencial para planejar e construir produtos.',
    recommended: true
  },
  {
    id: 'bmb',
    label: 'Oficina de agentes',
    description: 'Ferramentas para criar seus próprios agentes, fluxos e módulos.'
  },
  {
    id: 'cis',
    label: 'Inteligência criativa',
    description: 'Brainstorming, pesquisa criativa e geração de ideias.'
  },
  {
    id: 'gds',
    label: 'Estúdio de jogos',
    description: 'Fluxos voltados a desenvolvimento de jogos.'
  }
]

export interface BmadChoiceOption {
  id: string
  label: string
}

/**
 * Languages offered for `--communication-language` / `--document-output-language`.
 * The CLI accepts an arbitrary language string; this is a convenience shortlist
 * whose `id` (the value sent to the CLI) is the English/native name it expects.
 */
export const BMAD_LANGUAGE_OPTIONS: readonly BmadChoiceOption[] = [
  { id: 'English', label: 'English' },
  { id: 'Português', label: 'Português' },
  { id: 'Español', label: 'Español' },
  { id: 'Français', label: 'Français' },
  { id: 'Deutsch', label: 'Deutsch' }
]

export const DEFAULT_LANGUAGE = 'English'

/**
 * `bmm.user_skill_level` values (confirmed enum from `--list-options`:
 * beginner | intermediate | expert). Only relevant when `bmm` is selected.
 */
export const BMAD_SKILL_LEVELS: readonly BmadChoiceOption[] = [
  { id: 'beginner', label: 'Iniciante' },
  { id: 'intermediate', label: 'Intermediário' },
  { id: 'expert', label: 'Avançado' }
]

export const DEFAULT_SKILL_LEVEL = 'intermediate'
