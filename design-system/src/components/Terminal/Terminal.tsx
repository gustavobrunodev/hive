import type { ComponentPropsWithoutRef } from "react"
import { Chip } from "../Chip/Chip"
import { cx } from "../../utils/cx"
import "./Terminal.css"

export interface TerminalPhase {
  label: string
  active?: boolean
}

export interface TerminalProps extends ComponentPropsWithoutRef<"div"> {
  title?: string
  command?: string
  output?: string
  phases?: TerminalPhase[]
  cut?: boolean
}

export function Terminal({
  title,
  command,
  output,
  phases = [],
  cut = true,
  className,
  ...rest
}: TerminalProps) {
  return (
    <div className={cx("hds-term", cut && "cut", className)} {...rest}>
      <div className="hds-term-bar">
        <i />
        <i />
        <i />
        <span>{title}</span>
      </div>
      <div className="hds-term-body">
        <div className="hds-term-line">
          <span className="hds-term-pr">›</span>
          <span className="hds-term-cmd">{command}</span>
          <span className="hds-term-cur" aria-hidden="true" />
        </div>
        {output && <p className="hds-term-out">{output}</p>}
        {phases.length > 0 && (
          <div className="hds-term-phases" aria-hidden="true">
            {phases.map((phase) => (
              <Chip key={phase.label} variant="phase" active={phase.active}>
                {phase.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
