import { useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@hive/design-system'
import { t } from '../i18n'
import { HiveLogo } from '../ui/HiveLogo'
import {
  BMAD_LANGUAGE_OPTIONS,
  BMAD_MODULE_CATALOG,
  BMAD_SKILL_LEVELS,
  DEFAULT_LANGUAGE,
  DEFAULT_SKILL_LEVEL
} from './bmadInstallCatalog'

/**
 * The answers the guided form collects, structurally mirroring
 * `main/bmadService.ts`'s `BmadInstallOptions` (the renderer tsconfig doesn't
 * include `src/main`, so — like `chat/Chat.tsx` mirrors `AgentCapabilities` —
 * this is a local copy rather than a cross-boundary import; it stays
 * structurally assignable to `window.hive.installBmad`'s typed `options`).
 */
export interface BmadInstallConfig {
  modules: string[]
  userName?: string
  communicationLanguage?: string
  documentOutputLanguage?: string
  outputFolder?: string
  set?: Record<string, string>
}

interface InstallConfigFormProps {
  /** Invoked with the collected answers when the user submits the form. */
  onSubmit: (config: BmadInstallConfig) => void
}

/**
 * Guided workspace-configuration form (BUG 1). Rather than driving the real
 * interactive `bmad-method install` clack TUI over a pty (fragile screen
 * scraping), the app abstracts the CLI's questions — which modules, what to
 * call you, communication/document language, experience level — into its own
 * visual form, then hands the answers to `installBmad`, which runs the CLI
 * non-interactively with the matching flags (see bmadService.ts). This keeps
 * the app's "terminal abstracted into visual UI" contract (context.md C2)
 * instead of installing silently with no questions asked.
 *
 * The questions are the CLI's; the words are the product's. See
 * `bmadInstallCatalog.ts` for why the module labels are ours to write.
 */
export function InstallConfigForm({ onSubmit }: InstallConfigFormProps): React.JSX.Element {
  const [selectedModules, setSelectedModules] = useState<string[]>(() =>
    BMAD_MODULE_CATALOG.filter((module) => module.recommended).map((module) => module.id)
  )
  const [userName, setUserName] = useState('')
  const [communicationLanguage, setCommunicationLanguage] = useState(DEFAULT_LANGUAGE)
  const [documentOutputLanguage, setDocumentOutputLanguage] = useState(DEFAULT_LANGUAGE)
  const [skillLevel, setSkillLevel] = useState(DEFAULT_SKILL_LEVEL)
  const [showModulesError, setShowModulesError] = useState(false)

  const bmmSelected = selectedModules.includes('bmm')

  function toggleModule(id: string, checked: boolean): void {
    setSelectedModules((current) =>
      checked ? [...current, id] : current.filter((moduleId) => moduleId !== id)
    )
    if (checked) setShowModulesError(false)
  }

  function handleSubmit(event: React.SyntheticEvent): void {
    event.preventDefault()
    if (selectedModules.length === 0) {
      setShowModulesError(true)
      return
    }
    // `bmm.user_skill_level` only means anything when bmm is actually being
    // installed — omit the `--set` otherwise.
    const set = bmmSelected ? { 'bmm.user_skill_level': skillLevel } : undefined
    onSubmit({
      modules: selectedModules,
      userName: userName.trim() || undefined,
      communicationLanguage,
      documentOutputLanguage,
      set
    })
  }

  return (
    <main className="wb-gate wb-install-gate">
      {/* Every other screen in the first run wears the mark; this one — the
          only one that asks the user to decide something — used to be the one
          that didn't, and a form that shows up unbranded in the middle of an
          install reads as the underlying tool's, not as ours. */}
      <HiveLogo className="wb-gate-logo wb-install-logo" />
      <form className="wb-gate-card wb-install-form" onSubmit={handleSubmit}>
        <h1 className="wb-gate-title">{t('guidedInstall.form.title')}</h1>
        <p className="wb-gate-desc">{t('guidedInstall.form.description')}</p>

        <fieldset className="wb-install-fieldset">
          <legend className="wb-install-legend">{t('guidedInstall.form.modulesLegend')}</legend>
          <p className="wb-install-hint">{t('guidedInstall.form.modulesHint')}</p>
          <div className="wb-install-modules">
            {BMAD_MODULE_CATALOG.map((module) => {
              const checkboxId = `bmad-module-${module.id}`
              return (
                <div key={module.id} className="wb-install-module">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedModules.includes(module.id)}
                    onCheckedChange={(checked) => toggleModule(module.id, checked === true)}
                  />
                  <div className="wb-install-module-text">
                    <Label htmlFor={checkboxId}>{module.label}</Label>
                    <span className="wb-install-module-desc">{module.description}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {showModulesError && (
            <Alert variant="danger" role="alert" className="wb-install-modules-error">
              {t('guidedInstall.form.modulesRequiredError')}
            </Alert>
          )}
        </fieldset>

        <fieldset className="wb-install-fieldset">
          <legend className="wb-install-legend">{t('guidedInstall.form.identityLegend')}</legend>

          <Field label={t('guidedInstall.form.userNameLabel')}>
            <Input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder={t('guidedInstall.form.userNamePlaceholder')}
            />
          </Field>

          <Field label={t('guidedInstall.form.communicationLanguageLabel')}>
            <Select value={communicationLanguage} onValueChange={setCommunicationLanguage}>
              <SelectTrigger aria-label={t('guidedInstall.form.communicationLanguageLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BMAD_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('guidedInstall.form.documentOutputLanguageLabel')}>
            <Select value={documentOutputLanguage} onValueChange={setDocumentOutputLanguage}>
              <SelectTrigger aria-label={t('guidedInstall.form.documentOutputLanguageLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BMAD_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {bmmSelected && (
            <div className="wb-install-skill">
              <span className="wb-install-skill-label">
                {t('guidedInstall.form.skillLevelLabel')}
              </span>
              <p className="wb-install-hint">{t('guidedInstall.form.skillLevelHint')}</p>
              <RadioGroup value={skillLevel} onValueChange={setSkillLevel}>
                {BMAD_SKILL_LEVELS.map((option) => {
                  const radioId = `bmad-skill-${option.id}`
                  return (
                    <div key={option.id} className="wb-install-radio-row">
                      <RadioGroupItem id={radioId} value={option.id} />
                      <Label htmlFor={radioId}>{option.label}</Label>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>
          )}
        </fieldset>

        <div className="wb-install-actions">
          {/* The DS Button always renders `type="button"` (it omits `type`
              from its props), so it never submits the form on its own — wire
              the click straight to the submit handler. The form's `onSubmit`
              is kept so Enter-key submission still works. */}
          <Button cut={false} className="wb-btn wb-install-submit" onClick={handleSubmit}>
            {t('guidedInstall.form.submitCta')}
          </Button>
        </div>
      </form>
    </main>
  )
}
