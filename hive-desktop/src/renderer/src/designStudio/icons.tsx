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

/** Likert — a star: a score out of five. */
export function LikertIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 2.2l1.75 3.6 3.95.55-2.86 2.77.68 3.93L8 11.2l-3.52 1.85.68-3.93L2.3 6.35l3.95-.55z" />
    </svg>
  )
}

/** Voz do Cliente — a headset: a call with an attendant. */
export function VozIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3 9.5V8a5 5 0 0 1 10 0v1.5" />
      <path d="M3 9.25h1.75v3.5H3.75a.75.75 0 0 1-.75-.75zM13 9.25h-1.75v3.5h1a.75.75 0 0 0 .75-.75z" />
      <path d="M11.25 12.75c0 1-1.25 1.5-3.25 1.5" />
    </svg>
  )
}

/** FullStory — a pointer with its click: what a session records. */
export function FullStoryIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6 5.5l6.5 2.75-2.75 1-1 2.75z" />
      <path d="M3.5 3.5l1 1M6.25 1.75v1.5M2.25 6h1.5" />
    </svg>
  )
}

/** The glyph of a Fonte, by id. */
export function FonteIcon({
  fonte,
  ...rest
}: IconProps & { fonte: 'likert' | 'voz' | 'fullstory' }): React.JSX.Element {
  if (fonte === 'voz') return <VozIcon {...rest} />
  if (fonte === 'fullstory') return <FullStoryIcon {...rest} />
  return <LikertIcon {...rest} />
}
