import { t } from '../i18n'

/** Which detail the sheet is showing; `null` is the index itself. */
export type ProfileScope =
  'account' | 'agents' | 'shortcuts' | 'connection' | 'voice' | 'shell' | 'mcp'

/** The index's headings (nav-redesign) — what *kind* of decision the rows under them are. */
export type ScopeGroup = 'identity' | 'conversation' | 'system'

export interface ScopeMeta {
  id: ProfileScope
  label: string
  /** The sentence under the detail's title — what this scope decides. */
  hint: string
  group: ScopeGroup
}

/**
 * The scopes, in the order the index lists them, under three headings.
 *
 * Ordered by how often a settled user comes back to each, not by how the
 * features were built: identity first (it is what the header shows), then the
 * things that shape every conversation (agents, shortcuts, credentials), then
 * the machine-level choices that are usually set once (MCP, voice, terminal).
 *
 * **The headings arrived with the seventh row.** Six ungrouped rows were a list;
 * seven — once MCP left the toolbar and came here (nav-redesign) — is a pile,
 * and "Servidores MCP" between "Conexão" and "Voz e transcrição" says nothing
 * about which of them it resembles. Three headings answer that without adding a
 * level of navigation.
 *
 * Built as a **total** record rather than a list to search: with an entry per
 * union member, `scopeMeta` needs no "not found" fallback — a branch that can
 * never be taken, and that a future eighth scope would silently satisfy instead
 * of failing the typecheck.
 *
 * A module-level constant would freeze the copy at import time, before `t()`
 * ever matters to a locale switch — so these are functions.
 */
// `connection` sits with the two conversation-shaping scopes rather than with
// the machine-level ones below it: a credential that lapsed overnight stops
// every message, which makes it a thing you check *before* a working day, not
// a preference you set once. It used to be `aws`, and only `aws` — which meant
// the majority of machines, authorised by a Claude account rather than by
// Bedrock, had no row here at all (claude-account).
const SCOPE_ORDER: readonly ProfileScope[] = [
  'account',
  'agents',
  'shortcuts',
  'connection',
  'mcp',
  'voice',
  'shell'
]

/** The headings, in index order. */
export const SCOPE_GROUP_ORDER: readonly ScopeGroup[] = ['identity', 'conversation', 'system']

const GROUP_LABEL_KEY = {
  identity: 'profile.groupIdentityLabel',
  conversation: 'profile.groupConversationLabel',
  system: 'profile.groupSystemLabel'
} as const

export function scopeGroupLabel(group: ScopeGroup): string {
  return t(GROUP_LABEL_KEY[group])
}

function scopeTable(): Record<ProfileScope, ScopeMeta> {
  return {
    account: {
      id: 'account',
      label: t('profile.scopeAccountLabel'),
      hint: t('profile.scopeAccountHint'),
      group: 'identity'
    },
    agents: {
      id: 'agents',
      label: t('profile.scopeAgentsLabel'),
      hint: t('profile.scopeAgentsHint'),
      group: 'conversation'
    },
    shortcuts: {
      id: 'shortcuts',
      label: t('profile.scopeShortcutsLabel'),
      hint: t('profile.scopeShortcutsHint'),
      group: 'conversation'
    },
    connection: {
      id: 'connection',
      label: t('claude.scopeLabel'),
      hint: t('claude.scopeHint'),
      group: 'conversation'
    },
    mcp: {
      id: 'mcp',
      label: t('profile.scopeMcpLabel'),
      hint: t('profile.scopeMcpHint'),
      group: 'system'
    },
    voice: {
      id: 'voice',
      label: t('profile.scopeVoiceLabel'),
      hint: t('profile.scopeVoiceHint'),
      group: 'system'
    },
    shell: {
      id: 'shell',
      label: t('profile.scopeShellLabel'),
      hint: t('profile.scopeShellHint'),
      group: 'system'
    }
  }
}

/** Every scope, in index order. */
export function profileScopes(): ScopeMeta[] {
  const table = scopeTable()
  return SCOPE_ORDER.map((id) => table[id])
}

/** The scopes of one group, in index order. */
export function scopesInGroup(group: ScopeGroup): ScopeMeta[] {
  return profileScopes().filter((scope) => scope.group === group)
}

/** One scope's metadata, or `null` for the index. */
export function scopeMeta(scope: ProfileScope | null): ScopeMeta | null {
  return scope === null ? null : scopeTable()[scope]
}
