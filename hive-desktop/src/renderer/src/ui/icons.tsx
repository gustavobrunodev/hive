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

/**
 * explorer-os-actions: hand this entry to the host's file manager. The folder
 * says *what* opens; the departure arrow — the same one `ExternalLinkIcon`
 * uses for "leaves the app" — says the window that opens is not ours. Drawn
 * as a folder with the top-right corner given over to the arrow, rather than
 * an arrow badged onto a full folder, so at 14px it stays two readable shapes
 * instead of one crowded one.
 */
export function ExternalFolderIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M14.25 8.5v4.25c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1v-8.5c0-.55.45-1 1-1h3.1l1.4 1.5h1.9" />
      <path d="M10.75 2.25h3.5v3.5M14.25 2.25 10.5 6" />
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

/** design-studio T6.5: the Chat strip's expand affordance — the mirror of ChevronDownIcon. */
export function ChevronUpIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M4 9.75 8 6l4 3.75" />
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

/** Second Brain — a brain silhouette with a central sulcus (knowledge base). */
export function BrainIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 3.25v9.5" />
      <path d="M8 4.2A2.1 2.1 0 0 0 4.3 5.1 2 2 0 0 0 3 7a2 2 0 0 0 .5 3.3A2.1 2.1 0 0 0 8 12" />
      <path d="M8 4.2A2.1 2.1 0 0 1 11.7 5.1 2 2 0 0 1 13 7a2 2 0 0 1-.5 3.3A2.1 2.1 0 0 1 8 12" />
      <path d="M5.5 6.7c.7.3 1.3.3 2 0" />
      <path d="M10.5 6.7c-.7.3-1.3.3-2 0" />
    </svg>
  )
}

/** Microphone — live audio capture (the in-app recorder). */
export function MicIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="6" y="1.75" width="4" height="7.5" rx="2" />
      <path d="M3.75 7.25a4.25 4.25 0 0 0 8.5 0" />
      <path d="M8 11.5v2.75" />
    </svg>
  )
}

/** Waveform — an audio file to transcribe. */
export function WaveformIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2 6.5v3" />
      <path d="M5 4v8" />
      <path d="M8 2.25v11.5" />
      <path d="M11 4.5v7" />
      <path d="M14 6.5v3" />
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

/**
 * Three figures side by side — party mode (shortcut-scopes): the whole squad
 * of agents joining the conversation, as opposed to `PersonaChatIcon`'s single
 * specialist. The outer two sit lower and are drawn shorter so the group reads
 * at 13px instead of turning into a blob.
 */
export function PartyModeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="4.9" r="2.05" />
      <path d="M4.4 13.1c0-1.85 1.6-3.15 3.6-3.15s3.6 1.3 3.6 3.15" />
      <path d="M3.35 7.15a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />
      <path d="M1.3 11.85c0-1.35.9-2.35 2.2-2.45" />
      <path d="M12.65 7.15a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />
      <path d="M14.7 11.85c0-1.35-.9-2.35-2.2-2.45" />
    </svg>
  )
}

/* --- Chrome icons (rail, profile, chat controls) ----------------------- */

/** Settings gear (profile module entry). */
export function CompassIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m10.4 5.6-1.3 3.5-3.5 1.3 1.3-3.5 3.5-1.3Z" />
    </svg>
  )
}

export function GearIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="2.4" />
      <path d="M6.95 1.38A6.7 6.7 0 0 1 9.05 1.38L9.2 2.99A5.15 5.15 0 0 1 10.69 3.61L11.94 2.58A6.7 6.7 0 0 1 13.42 4.06L12.39 5.31A5.15 5.15 0 0 1 13.01 6.8L14.62 6.95A6.7 6.7 0 0 1 14.62 9.05L13.01 9.2A5.15 5.15 0 0 1 12.39 10.69L13.42 11.94A6.7 6.7 0 0 1 11.94 13.42L10.69 12.39A5.15 5.15 0 0 1 9.2 13.01L9.05 14.62A6.7 6.7 0 0 1 6.95 14.62L6.8 13.01A5.15 5.15 0 0 1 5.31 12.39L4.06 13.42A6.7 6.7 0 0 1 2.58 11.94L3.61 10.69A5.15 5.15 0 0 1 2.99 9.2L1.38 9.05A6.7 6.7 0 0 1 1.38 6.95L2.99 6.8A5.15 5.15 0 0 1 3.61 5.31L2.58 4.06A6.7 6.7 0 0 1 4.06 2.58L5.31 3.61A5.15 5.15 0 0 1 6.8 2.99L6.95 1.38Z" />
    </svg>
  )
}

/**
 * Opens something outside the app — the departure arrow on links that hand off
 * to the host browser.
 */
export function ExternalLinkIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M9.25 2.75h4v4M13.25 2.75 7.5 8.5" />
      <path d="M12 9.75v2.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V5.5A1.5 1.5 0 0 1 3.75 4h2.5" />
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

/**
 * Queue — an arrow landing on top of a short stack (send-while-busy).
 * Deliberately the send arrow's own gesture plus the stack it lands on: the
 * action is still "send", and the only new information is *where it goes*.
 */
export function QueueIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.75v5.5M5.5 4.75 8 2.25l2.5 2.5" />
      <path d="M2.75 9.75h10.5M4.75 12.75h6.5" />
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

/** Grip — six-dot drag handle (movable pane headers). */
export function PaperclipIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M13.1 7.4 8 12.5a3.08 3.08 0 0 1-4.36-4.36l5.57-5.57a2.05 2.05 0 0 1 2.9 2.9L6.55 11a1.03 1.03 0 0 1-1.45-1.45l4.86-4.86" />
    </svg>
  )
}

export function GripIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="6" cy="3.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="3.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Move horizontal — left/right arrows (the "move pane" menu affordance). */
export function MoveHorizontalIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.75 8h12.5" />
      <path d="m4.5 5.25-2.75 2.75 2.75 2.75" />
      <path d="m11.5 5.25 2.75 2.75-2.75 2.75" />
    </svg>
  )
}

/** History — clock with a rewind arrow (session-history panel trigger). */
export function HistoryIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.55 6.2A5.75 5.75 0 1 1 2.25 8" />
      <path d="M2.1 2.8v3.4h3.4" />
      <path d="M8 5.2v3.05l2.3 1.4" />
    </svg>
  )
}

/** Search — magnifier (session-history filter field). */
export function SearchIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="7.25" cy="7.25" r="4.5" />
      <path d="m13.75 13.75-3.3-3.3" />
    </svg>
  )
}

/** Chat bubble — one saved conversation (history rows, hero recents, empty state). */
export function ChatBubbleIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M13.75 3.6c0-.47-.38-.85-.85-.85H3.1c-.47 0-.85.38-.85.85v6.3c0 .47.38.85.85.85h2.15v2.5l3-2.5h4.65c.47 0 .85-.38.85-.85V3.6Z" />
    </svg>
  )
}

/** Person silhouette — the profile avatar's fallback when no name is set. */
export function UserIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="5.25" r="2.75" />
      <path d="M2.9 13.5c.55-2.35 2.6-3.75 5.1-3.75s4.55 1.4 5.1 3.75" />
    </svg>
  )
}

/** Download arrow into a tray — the app-update download action. */
export function DownloadIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 2.5v7M4.75 6.5 8 9.75l3.25-3.25" />
      <path d="M2.75 11.5v1.25c0 .41.34.75.75.75h9c.41 0 .75-.34.75-.75V11.5" />
    </svg>
  )
}

/** Circular arrows — "check for updates" (app settings). */
export function RefreshIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71" />
      <path d="M13.5 2.5v2.25h-2.25" />
    </svg>
  )
}

/** Horizontal sliders — "Personalizar atalhos" (shortcut-customization). */
export function SlidersIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.25 4.75h5M10.75 4.75h3M2.25 11.25h3M8.75 11.25h5" />
      <circle cx="9" cy="4.75" r="1.6" />
      <circle cx="7" cy="11.25" r="1.6" />
    </svg>
  )
}

/** Four-point spark — the Skill Studio (skill-studio): creation, the "made by you" marker. */
export function SparkleIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.9c.5 2.6 1.4 3.9 4.1 4.6-2.7.7-3.6 2-4.1 4.6-.5-2.6-1.4-3.9-4.1-4.6 2.7-.7 3.6-2 4.1-4.6Z" />
      <path d="M12.9 10.4c.25 1.3.7 1.95 2.05 2.3-1.35.35-1.8 1-2.05 2.3-.25-1.3-.7-1.95-2.05-2.3 1.35-.35 1.8-1 2.05-2.3Z" />
    </svg>
  )
}

/** Play triangle — "test this skill in the chat" (skill-studio). */
export function PlayIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5.25 3.4c0-.6.65-.97 1.17-.66l7 4.1a.77.77 0 0 1 0 1.32l-7 4.1a.77.77 0 0 1-1.17-.66V3.4Z" />
    </svg>
  )
}

/** Left arrow — back navigation inside a dialog flow (skill-studio create → gallery). */
export function ArrowLeftIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M13.25 8H2.75M7 3.75 2.75 8 7 12.25" />
    </svg>
  )
}

/** Gauge/target — eval runs (skill-studio): measuring a skill against its cases. */
export function GaugeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="6.25" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="0.4" fill="currentColor" stroke="none" />
      <path d="M8 1.75v2M8 12.25v2M1.75 8h2M12.25 8h2" />
    </svg>
  )
}

/** Plug/connector — the MCP module (mcp): a Model Context Protocol server connection. */
export function PlugIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5.5 1.75v3M10.5 1.75v3" />
      <path d="M3.75 4.75h8.5v2.5a4.25 4.25 0 0 1-8.5 0z" />
      <path d="M8 11.5v2.75" />
    </svg>
  )
}

/** Broadcast/waves — a remote (http/sse) MCP transport. */
export function BroadcastIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <path d="M4.8 4.8a4.5 4.5 0 0 0 0 6.4M11.2 4.8a4.5 4.5 0 0 1 0 6.4" />
      <path d="M2.6 2.6a7.5 7.5 0 0 0 0 10.8M13.4 2.6a7.5 7.5 0 0 1 0 10.8" />
    </svg>
  )
}

/** Terminal prompt — a local (stdio) MCP transport: a spawned command. */
export function TerminalIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <path d="M4.5 6.25 6.75 8 4.5 9.75M8.25 10h3" />
    </svg>
  )
}

/** Wrench/tools — the tools an MCP server advertises. */
export function ToolsIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M10.4 2.4a3 3 0 0 0-3.9 3.8l-4 4a1.4 1.4 0 0 0 2 2l4-4a3 3 0 0 0 3.8-3.9L10.5 6 9 4.5z" />
    </svg>
  )
}

/** Lightning/power — the connection test action (probe a server). */
export function ZapIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8.75 1.75 3.5 8.75h4L7.25 14.25l5.25-7h-4z" />
    </svg>
  )
}

/** Filled status dot — the connection state indicator on a server row. */
export function StatusDotIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="4" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Warning triangle — a server that failed to connect. */
export function AlertTriangleIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 2.5 14.25 13H1.75z" />
      <path d="M8 6.5v3M8 11.4v.1" />
    </svg>
  )
}

/**
 * Agent brand marks (multi-agent) — distinctive per-agent glyphs for the
 * onboarding picker, profile, composer switcher and history badges. Abstract
 * evocations (a radial spark, a pilot ring, an orbiting node), NOT reproductions
 * of the vendors' trademarks; they share the app's geometric family so three
 * agents read as one system with three identities.
 */

/** Claude — a radial burst/spark (Anthropic's mark reads as a starburst). */
export function AgentClaudeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 1.5v13M3.4 3.4l9.2 9.2M1.5 8h13M3.4 12.6l9.2-9.2" />
    </svg>
  )
}

/** GitHub Copilot — a pilot ring with goggle eyes (friendly co-pilot). */
export function AgentCopilotIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.5 9.2c0-2.5 2.2-4 5.5-4s5.5 1.5 5.5 4c0 2-1.4 3.3-3 3.3-1 0-1.7-.5-2.5-.5s-1.5.5-2.5.5c-1.6 0-3-1.3-3-3.3Z" />
      <path d="M8 5.2 7.2 2.6M8 5.2l1-2.6" />
      <circle cx="5.6" cy="9.2" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="9.2" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Devin — an orbiting node (autonomous agent circling a task). */
export function AgentDevinIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="2.4" />
      <ellipse cx="8" cy="8" rx="6" ry="2.6" transform="rotate(32 8 8)" />
      <circle cx="12.7" cy="5.7" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Star — "default agent" toggle (multi-agent). `filled` marks the active default. */
export function StarIcon({
  size,
  filled,
  ...rest
}: IconProps & { filled?: boolean }): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest} fill={filled ? 'currentColor' : 'none'}>
      <path d="M8 1.75l1.85 3.9 4.15.55-3.05 2.9.78 4.15L8 11.9l-3.73 2.35.78-4.15L2 7.2l4.15-.55L8 1.75Z" />
    </svg>
  )
}

/** Padlock — the locked per-conversation agent badge (multi-agent). */
export function LockIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" />
      <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

/** Zoom in — magnifier with a plus. Rich file viewer toolbar. */
export function ZoomInIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.5 10.5 3 3M7 5.25v3.5M5.25 7h3.5" />
    </svg>
  )
}

/** Zoom out — magnifier with a minus. Rich file viewer toolbar. */
export function ZoomOutIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.5 10.5 3 3M5.25 7h3.5" />
    </svg>
  )
}

/** Fit to view — inward-pointing corner arrows. Resets zoom in the file viewer. */
export function FitIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.5 5.5v-3h3M13.5 5.5v-3h-3M2.5 10.5v3h3M13.5 10.5v3h-3" />
    </svg>
  )
}

/** Chevron left — previous page / slide. */
export function ChevronLeftIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M10 4 6 8l4 4" />
    </svg>
  )
}

/** Chevron right — next page / slide. */
export function ChevronRightIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

/** Arrow up — npm-distribution's `UpdateNotice` header glyph (design.md §5 Tier 2's "▲"): a new version is something to rise to, not a warning. */
export function ArrowUpIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 13V3M4.25 6.75 8 3l3.75 3.75" />
    </svg>
  )
}

/* --- Source control icons (git-management, M10) ------------------------- */

/**
 * Source Control — the activity-rail view entry (git-management GIT-R13). A
 * branch node: a commit dot with a fork line splitting to a second dot, the
 * VS Code source-control silhouette rendered in the app's geometric family.
 */
export function SourceControlIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="4.25" cy="4" r="1.75" />
      <circle cx="4.25" cy="12" r="1.75" />
      <circle cx="11.75" cy="6" r="1.75" />
      <path d="M4.25 5.75v4.5M11.75 7.75c0 2.4-1.9 3.4-4 3.75" />
    </svg>
  )
}

/** Branch — two commit dots on a forking line (branch picker, status-bar pill). */
export function BranchIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="4.5" cy="3.5" r="1.6" />
      <circle cx="4.5" cy="12.5" r="1.6" />
      <circle cx="11.5" cy="4.75" r="1.6" />
      <path d="M4.5 5.1v5.8M11.5 6.35c0 2.9-2.35 3-7 4.15" />
    </svg>
  )
}

/** Commit — a node centered on a horizontal line (history, commit action). */
export function CommitIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="2.75" />
      <path d="M1.75 8h3.5M10.75 8h3.5" />
    </svg>
  )
}

/** Merge — a side branch curving back into the mainline (conflict/merge surfaces). */
export function MergeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="4.5" cy="3.5" r="1.6" />
      <circle cx="4.5" cy="12.5" r="1.6" />
      <circle cx="11.5" cy="7" r="1.6" />
      <path d="M4.5 5.1v5.8M4.5 8.5c0-2.6 2.35-2.85 5.5-2.85" />
    </svg>
  )
}

/** Sync — two arrows chasing in a circle (fetch/pull/push/sync). */
export function SyncIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M12.7 6.4A5 5 0 0 0 3.6 5M3.3 9.6A5 5 0 0 0 12.4 11" />
      <path d="M12.75 2.75v3.5h-3.5M3.25 13.25v-3.5h3.5" />
    </svg>
  )
}

/** Stash — an inbox/tray a change is tucked into (stash list + action). */
export function StashIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.75 8.5 3.4 3.6c.13-.4.5-.68.92-.68h7.36c.42 0 .79.28.92.68L14.25 8.5" />
      <path d="M1.75 8.5v3.75c0 .55.45 1 1 1h10.5c.55 0 1-.45 1-1V8.5h-3.5l-.9 1.5H6.15l-.9-1.5H1.75Z" />
    </svg>
  )
}

/** Check-circle — a resolved/clean state (clean tree, resolved conflict). */
export function CheckCircleIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.25 8 1.9 1.9L10.9 6" />
    </svg>
  )
}

/** Discard — a counter-clockwise reset arrow (restore a change to HEAD). */
export function DiscardIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3.35 6.2A5.75 5.75 0 1 1 3 8" />
      <path d="M2.1 2.8v3.4h3.4" />
    </svg>
  )
}

/** Arrow down — commits behind the upstream (status-bar ↓ counter to ArrowUpIcon's ↑). */
export function ArrowDownIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 3v10M4.25 9.25 8 13l3.75-3.75" />
    </svg>
  )
}

/** Minus — the "unstage" row/group action (counterpart to PlusIcon's stage). */
export function MinusIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3 8h10" />
    </svg>
  )
}

/**
 * Activity — a pulse trace. The MCP console's mark, in the status bar and on
 * the dock: it reads as "something is happening over there", which is exactly
 * what the console reports.
 */
export function ActivityIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" />
    </svg>
  )
}

/** Maximize — grow the dock to fill the work area (diagonal corner arrows). */
export function MaximizeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6.5 2.5h-4v4M9.5 13.5h4v-4M2.5 2.5l4.5 4.5M13.5 13.5 9 9" />
    </svg>
  )
}

/** Minimize — return the dock to its docked height (diagonal inward arrows). */
export function MinimizeIcon({ size, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2.5 6.5h4v-4M13.5 9.5h-4v4M2.5 2.5 6.5 6.5M13.5 13.5 9.5 9.5" />
    </svg>
  )
}
