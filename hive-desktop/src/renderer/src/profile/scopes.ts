import { t } from '../i18n'

/** Which detail the sheet is showing; `null` is the index itself. */
export type ProfileScope = 'account' | 'agents' | 'shortcuts' | 'voice' | 'shell'

export interface ScopeMeta {
  id: ProfileScope
  label: string
  /** The sentence under the detail's title — what this scope decides. */
  hint: string
}

/**
 * The scopes, in the order the index lists them.
 *
 * Ordered by how often a settled user comes back to each, not by how the
 * features were built: identity first (it is what the header shows), then the
 * two things that shape every conversation (agents, shortcuts), then the two
 * machine-level choices that are usually set once (voice, terminal).
 *
 * Built as a **total** record rather than a list to search: with an entry per
 * union member, `scopeMeta` needs no "not found" fallback — a branch that can
 * never be taken, and that a future sixth scope would silently satisfy instead
 * of failing the typecheck.
 *
 * A module-level constant would freeze the copy at import time, before `t()`
 * ever matters to a locale switch — so these are functions.
 */
const SCOPE_ORDER: readonly ProfileScope[] = ['account', 'agents', 'shortcuts', 'voice', 'shell']

function scopeTable(): Record<ProfileScope, ScopeMeta> {
  return {
    account: {
      id: 'account',
      label: t('profile.scopeAccountLabel'),
      hint: t('profile.scopeAccountHint')
    },
    agents: {
      id: 'agents',
      label: t('profile.scopeAgentsLabel'),
      hint: t('profile.scopeAgentsHint')
    },
    shortcuts: {
      id: 'shortcuts',
      label: t('profile.scopeShortcutsLabel'),
      hint: t('profile.scopeShortcutsHint')
    },
    voice: { id: 'voice', label: t('profile.scopeVoiceLabel'), hint: t('profile.scopeVoiceHint') },
    shell: { id: 'shell', label: t('profile.scopeShellLabel'), hint: t('profile.scopeShellHint') }
  }
}

/** Every scope, in index order. */
export function profileScopes(): ScopeMeta[] {
  const table = scopeTable()
  return SCOPE_ORDER.map((id) => table[id])
}

/** One scope's metadata, or `null` for the index. */
export function scopeMeta(scope: ProfileScope | null): ScopeMeta | null {
  return scope === null ? null : scopeTable()[scope]
}
