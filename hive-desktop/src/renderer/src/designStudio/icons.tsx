import type { ComponentPropsWithoutRef } from 'react'

/**
 * The module's own glyphs, drawn in the app icon family (`ui/icons.tsx`):
 * 16×16, 1.5px stroke, `currentColor`, round caps. Shapes from the validated
 * prototype, redrawn at this grid — its colours never travel with them.
 */
type IconProps = ComponentPropsWithoutRef<'svg'> & { size?: number }

function base(size: number | undefined): ComponentPropsWithoutRef<'svg'> {
  const s = size ?? 16
  return {
    width: s,
    height: s,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }
}

/** The module's mark: a rounded tile holding a "D" and its dot, as the prototype's brand sign. */
export function DesignStudioIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
      <path d="M5 11V5h2.5a3 3 0 0 1 0 6z" />
      <circle cx="11.1" cy="10.9" r="0.6" fill="currentColor" />
    </svg>
  )
}

/** Início. */
export function HomeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.5 7 8 2.5 13.5 7v6.25a.75.75 0 0 1-.75.75H10V10H6v4H3.25a.75.75 0 0 1-.75-.75z" />
    </svg>
  )
}

/** Dores — the prototype's heart. */
export function DorIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 13.5S2.75 10.4 2.75 6.6A2.85 2.85 0 0 1 8 5.05a2.85 2.85 0 0 1 5.25 1.55c0 3.8-5.25 6.9-5.25 6.9z" />
    </svg>
  )
}

/** Relatórios — a page carrying three bars. */
export function RelatorioIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 1.75h6l2.5 2.5v10h-8.5z" />
      <path d="M6 11.5v-2M8 11.5v-4M10 11.5V9" />
    </svg>
  )
}
