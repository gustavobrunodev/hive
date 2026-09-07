import { t } from '../i18n'
import { awsSummary } from '../aws/awsSummary'
import type { AwsStatus } from '../aws/useAwsSession'
import { accountLine } from './claudeSession'
import type { ClaudeStatus } from './useClaudeAuth'

/**
 * The one-line summary the profile index shows on the "Conexão do Claude" row.
 *
 * It has to answer, in the width of a list row, the question the row exists
 * for: *will the next message work, and on whose credentials?* Which means it
 * cannot be a summary of one lane — the row would then be blank, or worse
 * confidently wrong, on half of all machines. So the lane in use decides what
 * the line says:
 *
 *  - `null` — main hasn't answered yet; the index draws a skeleton rather than
 *    a fact that may be about to change (`status` here costs a spawn).
 *  - **Bedrock** — the AWS reading, exactly as that lane already worded it.
 *  - **a Claude account** — who is signed in (`pessoa@exemplo.dev · Plano Pro`),
 *    because "as whom" is the second question and it fits.
 *  - **signed out** — the one state worth its own words: it is what will stop
 *    the next message.
 *
 * Its own module rather than a component's, because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components`.
 */
export function connectionSummary(
  claude: ClaudeStatus | null,
  aws: AwsStatus | null
): string | null {
  if (claude === null) return null
  // The CLI's own verdict first: `apiProvider: "bedrock"` is a fact about the
  // machine, and it outranks Hive's reading of the AWS files.
  if (claude.state === 'third-party' || aws?.active === true) return awsSummary(aws)
  if (claude.state === 'connected') {
    return accountLine(claude.account) ?? t('claude.stateConnected')
  }
  if (claude.state === 'signed-out') return t('claude.stateSignedOut')
  if (claude.state === 'api-key') return t('claude.stateApiKey')
  if (claude.state === 'no-cli') return t('claude.stateNoCli')
  return t('claude.stateUnknown')
}
