import { workspaceHue, workspaceMonogram } from './workspaceVisuals'

interface WorkspaceMarkProps {
  /** Absolute path — the hue seed. */
  path: string
  /** Display name — the monogram seed. */
  name: string
  /** Tile edge in px (the type scales with it). */
  size?: number
  /** Renders the folder as gone: drained of hue, dashed edge. */
  missing?: boolean
  className?: string
}

/**
 * The workspace identity tile (multi-workspace) — a monogram in the hue
 * `workspaceVisuals.ts` derives from the path.
 *
 * Purely decorative: every place this appears also renders the workspace's
 * name as text, so the mark is `aria-hidden` and adds nothing to the
 * accessibility tree it would only duplicate.
 */
export function WorkspaceMark({
  path,
  name,
  size = 28,
  missing = false,
  className
}: WorkspaceMarkProps): React.JSX.Element {
  return (
    <span
      className={className ? `wb-ws-mark ${className}` : 'wb-ws-mark'}
      data-missing={missing || undefined}
      style={
        {
          '--wb-ws-hue': `var(--wb-ic-${workspaceHue(path)})`,
          '--wb-ws-size': `${size}px`
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <span className="wb-ws-mark-text">{workspaceMonogram(name)}</span>
    </span>
  )
}
