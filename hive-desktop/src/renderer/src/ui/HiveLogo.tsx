import { useLayoutEffect, useRef } from 'react'
import { Logo } from '@hive/design-system'

export interface HiveLogoProps {
  mark?: 'brain' | 'simple' | 'description'
  className?: string
}

/**
 * The brain-mark lockups ship on a 1408×768 canvas with the artwork
 * occupying only the middle ~20% (measured via getBBox in T-impeccable's
 * browser pass) — rendered raw, a "44px logo" shows a ~17px mark. Cropping
 * the viewBox to the artwork (plus a small safety margin) makes the CSS
 * height mean what it says.
 */
const BRAIN_VIEWBOX = '556 153 298 308'

/**
 * Theme-aware Hive logo for app chrome and gate screens. Renders the white
 * and black lockups and lets CSS (`workbench.css`, keyed off the
 * `data-theme` attribute App.tsx maintains) show the right one — the DS
 * `Logo` bakes its fill into the SVG source, so it can't recolor itself.
 */
export function HiveLogo({ mark = 'brain', className }: HiveLogoProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (mark !== 'brain' || !ref.current) return
    for (const svg of ref.current.querySelectorAll('svg')) {
      svg.setAttribute('viewBox', BRAIN_VIEWBOX)
    }
  }, [mark])

  return (
    <span ref={ref} className={className}>
      <Logo tone="white" mark={mark} className="wb-logo-dark" />
      <Logo tone="black" mark={mark} className="wb-logo-light" />
    </span>
  )
}
