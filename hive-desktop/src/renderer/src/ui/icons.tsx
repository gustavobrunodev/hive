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

export function ChevronDownIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M4 6.25 8 10l4-3.75" />
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

export function EyeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.75" />
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

/* --- Role icons (role-personalization RP-R1.2) ------------------------- */

/** Product Manager (John) — briefcase. */
export function RolePmIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="2.5" y="4.75" width="11" height="8.25" rx="1.25" />
      <path d="M5.75 4.75V3.6c0-.55.45-1 1-1h2.5c.55 0 1 .45 1 1v1.15" />
      <path d="M2.5 8.5h11" />
    </svg>
  )
}

/** Tech Lead (Winston) — architect's compass. */
export function RoleTechLeadIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="6" />
      <path d="M10.6 5.4 8.85 8.85 5.4 10.6l1.75-3.45L10.6 5.4Z" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** UX Designer (Sally) — palette. */
export function RoleUxIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.75a6.25 6.25 0 0 0 0 12.5c.85 0 1.4-.68 1.4-1.4 0-.34-.14-.65-.35-.9-.2-.24-.35-.55-.35-.9 0-.72.58-1.3 1.3-1.3h1.53A3.17 3.17 0 0 0 14.25 6.6 6.35 6.35 0 0 0 8 1.75Z" />
      <circle cx="5.35" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="8" cy="4.85" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="10.65" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** QA (Murat) — shield with a check. */
export function RoleQaIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.75 13 3.5v4.1c0 3.2-2.2 5.45-5 6.65-2.8-1.2-5-3.45-5-6.65V3.5L8 1.75Z" />
      <path d="m5.85 8 1.55 1.55L10.3 6.4" />
    </svg>
  )
}

/** Developer (Amelia) — angle brackets. */
export function RoleDevIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5.4 4.5 2.25 8l3.15 3.5M10.6 4.5 13.75 8l-3.15 3.5M9.1 3.1 6.9 12.9" />
    </svg>
  )
}

/* --- Action / persona icons (role actions + slash menu) ----------------- */

/** Product brief — clipboard with lines. */
export function ClipboardIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="3.25" y="2.75" width="9.5" height="11" rx="1" />
      <path d="M6 2.75V2c0-.4.35-.75.75-.75h2.5c.4 0 .75.35.75.75v.75" />
      <path d="M5.75 6.5h4.5M5.75 9h4.5M5.75 11.25h2.5" />
    </svg>
  )
}

/** Epics & stories — stacked layers. */
export function LayersIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.75 14 5l-6 3.25L2 5l6-3.25Z" />
      <path d="m2 8 6 3.25L14 8M2 11l6 3.25L14 11" />
    </svg>
  )
}

/** Test design — beaker. */
export function BeakerIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6.25 2.25v3.6L3.35 11.1c-.4.7.1 1.65.95 1.65h7.4c.85 0 1.35-.95.95-1.65L9.75 5.85V2.25" />
      <path d="M5.75 2.25h4.5M5.1 9h5.8" />
    </svg>
  )
}

/** Test automation — cycle arrows (run repeatedly). */
export function AutomationIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M12.5 8a4.5 4.5 0 0 1-7.85 3M3.5 8a4.5 4.5 0 0 1 7.85-3" />
      <path d="M11.35 2.4v2.6H8.75M4.65 13.6V11h2.6" />
    </svg>
  )
}

/** Code review — magnifier over code with a check. */
export function ReviewIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="6.75" cy="6.75" r="4" />
      <path d="m9.75 9.75 3.5 3.5" />
      <path d="m5.1 6.85 1.15 1.15 2.2-2.35" />
    </svg>
  )
}

/** Persona conversation — speech bubble with three dots. */
export function PersonaChatIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.75 7.75c0-2.85 2.35-4.75 5.25-4.75s5.25 1.9 5.25 4.75S10.9 12.5 8 12.5c-.5 0-1-.05-1.45-.16L3.5 13.5l.72-2.2A4.55 4.55 0 0 1 2.75 7.75Z" />
      <circle cx="6" cy="7.75" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8" cy="7.75" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.75" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

/* --- Chrome icons (rail, profile, chat controls) ----------------------- */

/** Settings gear (profile module entry). */
export function GearIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="2.15" />
      <path d="M8 1.5l.62 1.72 1.8-.5 1.16 1.4 1.72.62-.5 1.8L14.5 8l-1.3 1.3.5 1.8-1.72.62-1.16 1.4-1.8-.5L8 14.5l-1.3-1.06-1.8.5-1.16-1.4-1.72-.62.5-1.8L1.5 8l1.06-1.3-.5-1.8 1.72-.62L5.9 2.5l1.8.5L8 1.5Z" />
    </svg>
  )
}

/** Bolt — the "Ações" launcher affordance. */
export function BoltIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8.75 1.5 3.5 8.75h3.4L7.25 14.5l5.25-7.25H9L8.75 1.5Z" />
    </svg>
  )
}

/** Stop — filled rounded square (interrupt the running response). */
export function StopIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="4" y="4" width="8" height="8" rx="1.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Slash — the slash-command menu affordance. */
export function SlashIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M10 2.75 6 13.25" />
    </svg>
  )
}
