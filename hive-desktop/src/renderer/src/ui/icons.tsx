import type { ComponentPropsWithoutRef } from 'react'

/**
 * App icon set — 16×16, 1.5px stroke, `currentColor` (design-system
 * DESIGN.md "States, Motion & Icons": the DS ships no icon set; the
 * consuming app supplies SVGs at fixed 16/20px boxes that inherit the
 * text-role token they sit in). One visual family: geometric, round caps,
 * no fills except where a shape reads better solid.
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

export function FolderIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.75 3.75c0-.55.45-1 1-1h3.1l1.4 1.5h5c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1v-8.5Z" />
    </svg>
  )
}

export function FolderOpenIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.75 3.75c0-.55.45-1 1-1h3.1l1.4 1.5h4.5c.55 0 1 .45 1 1v1.25" />
      <path d="M1.75 12.25 3.3 7.1c.13-.42.52-.72.96-.72h8.9c.67 0 1.15.65.96 1.29l-1.1 3.86c-.12.43-.51.72-.96.72H1.75Z" />
    </svg>
  )
}

export function FileIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 2.75c0-.55.45-1 1-1h4.4l3.1 3.1v8.4c0 .55-.45 1-1 1h-6.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="M9 1.9v2.35c0 .41.34.75.75.75h2.35" />
    </svg>
  )
}

export function FileTextIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 2.75c0-.55.45-1 1-1h4.4l3.1 3.1v8.4c0 .55-.45 1-1 1h-6.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="M6 8.25h4M6 10.75h4" />
    </svg>
  )
}

export function FileCodeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.75 2.75c0-.55.45-1 1-1h4.4l3.1 3.1v8.4c0 .55-.45 1-1 1h-6.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="m6.6 8-1.35 1.4L6.6 10.8M9.4 8l1.35 1.4L9.4 10.8" />
    </svg>
  )
}

export function SunIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.13 1.13M11.47 11.47l1.13 1.13M12.6 3.4l-1.13 1.13M4.53 11.47 3.4 12.6" />
    </svg>
  )
}

export function MoonIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
    </svg>
  )
}

export function CopyIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="5.75" y="5.75" width="8" height="8" rx="1" />
      <path d="M10.25 3.25v-.5c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h.5" />
    </svg>
  )
}

export function CheckIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="m3.25 8.5 3 3 6.5-7" />
    </svg>
  )
}

export function CloseIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  )
}

/** Hexagon cell — the hive mark used as the agent's chat avatar. */
export function HiveCellIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.75 13.4 4.9v6.2L8 14.25 2.6 11.1V4.9L8 1.75Z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PlusIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export function FolderPlusIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.75 3.75c0-.55.45-1 1-1h3.1l1.4 1.5h5c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1v-8.5Z" />
      <path d="M8 7v3.5M6.25 8.75h3.5" />
    </svg>
  )
}

export function TrashIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.75 4.25h10.5M6 4.25V2.9c0-.36.29-.65.65-.65h2.7c.36 0 .65.29.65.65v1.35" />
      <path d="M3.9 4.25 4.4 12.6c.03.53.47.95 1 .95h5.2c.53 0 .97-.42 1-.95l.5-8.35" />
      <path d="M6.6 7v3.75M9.4 7v3.75" />
    </svg>
  )
}

export function PencilIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M10.4 2.6a1.3 1.3 0 0 1 1.84 1.84L4.9 12.78l-2.4.6.6-2.4 7.3-8.38Z" />
    </svg>
  )
}

export function MoreIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="3.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/* --- Intent icons (20px contexts) ------------------------------------- */

export function IntentPrdIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.25 2.75c0-.55.45-1 1-1h7.5c.55 0 1 .45 1 1v10.5c0 .55-.45 1-1 1h-7.5c-.55 0-1-.45-1-1V2.75Z" />
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" />
    </svg>
  )
}

export function IntentBrainstormIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.75v2M12.42 3.58l-1.41 1.41M14.25 8h-2M3.58 3.58l1.41 1.41M1.75 8h2" />
      <path d="M8 6.25A2.75 2.75 0 0 1 10.75 9c0 1.1-.75 1.7-.75 2.5h-4c0-.8-.75-1.4-.75-2.5A2.75 2.75 0 0 1 8 6.25ZM6.75 13.75h2.5" />
    </svg>
  )
}

export function IntentResearchIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3.5 3.5" />
    </svg>
  )
}

export function IntentArchitectureIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="5.75" y="1.75" width="4.5" height="4.5" rx="0.75" />
      <rect x="1.75" y="9.75" width="4.5" height="4.5" rx="0.75" />
      <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.75" />
      <path d="M8 6.25v1.5M4 9.75V8.5h8v1.25" />
    </svg>
  )
}

export function IntentStoryIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M4.25 2.75c0-.55.45-1 1-1h5.5c.55 0 1 .45 1 1v11.5L8 11.4l-3.75 2.85V2.75Z" />
    </svg>
  )
}
