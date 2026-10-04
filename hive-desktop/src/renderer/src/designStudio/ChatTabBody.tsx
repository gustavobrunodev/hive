import type { ReactNode } from 'react'
import { useMountedLayers } from '../ui/useMountedLayers'

type ChatBodyLayer = 'hive' | 'design'

export interface ChatTabBodyProps {
  /** The Design Studio is in front of the work area. */
  designActive: boolean
  /** The Hive's own body: Iniciativas and the conversation list. */
  hive: ReactNode
  /** The module's navigation. */
  design: ReactNode
}

/**
 * The Chat & Cowork tab's body under the tools — the Hive's, or the Design
 * Studio's navigation while the module is in front (decision 1).
 *
 * Both stay mounted once shown, as layers of one stack, and only visibility
 * changes (`.ds-chatbody-layer`). Swapping one for the other would throw away
 * the conversation list's scroll and every release folder opened in
 * Iniciativas, which is what the way back out of the module has to find
 * untouched (criterion 3). The Hive's layer is mounted from the first frame;
 * the module's on its first visit.
 */
export function ChatTabBody({ designActive, hive, design }: ChatTabBodyProps): React.JSX.Element {
  const active: ChatBodyLayer = designActive ? 'design' : 'hive'
  const mounted = useMountedLayers<ChatBodyLayer>(active, ['hive'])
  return (
    <div className="ds-chatbody">
      <div
        className="ds-chatbody-layer"
        data-chat-body="hive"
        data-active={!designActive || undefined}
      >
        {hive}
      </div>
      {mounted.includes('design') && (
        <div
          className="ds-chatbody-layer"
          data-chat-body="design"
          data-active={designActive || undefined}
        >
          {design}
        </div>
      )}
    </div>
  )
}
