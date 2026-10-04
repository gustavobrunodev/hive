import { t } from '../../i18n'
import { sessionTitle } from '../../chat/sessionMeta'
import type { ModuleConversation } from '../useDesignStudio'
import { SampleSeal } from './PageHeader'

/** The conversation's title, as the history list writes it — or "Conversa" before the listing knows it. */
function conversaTitle(conversation: ModuleConversation | undefined): string {
  return conversation === undefined
    ? t('designStudio.conversa.titleUnknown')
    : sessionTitle(conversation)
}

/**
 * P13 — a conversation at the Produto level (task A, slice 6). Here, its
 * header: the title, then the row of chips the seal belongs to.
 */
export function ConversaPage({
  conversation,
  seal
}: {
  conversation: ModuleConversation | undefined
  seal: boolean
}): React.JSX.Element {
  return (
    <div className="ds-page ds-conversa">
      <header className="ds-conversa-head">
        <h1 className="ds-conversa-title">{conversaTitle(conversation)}</h1>
        {seal && (
          <div className="ds-conversa-chips">
            <SampleSeal />
          </div>
        )}
      </header>
    </div>
  )
}
