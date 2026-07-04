import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { Panel } from "../Panel/Panel"
import { Chip } from "../Chip/Chip"
import { cx } from "../../utils/cx"
import "./Timeline.css"

export interface SpineLabelProps extends ComponentPropsWithoutRef<"div"> {}

export function SpineLabel({ children, ...rest }: SpineLabelProps) {
  return (
    <div className="hds-spine-label" {...rest}>
      <span className="hds-sw" aria-hidden="true" />
      {children}
    </div>
  )
}

export interface FlowProps extends ComponentPropsWithoutRef<"div"> {}

export function Flow({ className, children, ...rest }: FlowProps) {
  return (
    <div className={cx("hds-flow", className)} {...rest}>
      {children}
    </div>
  )
}

export interface StepsProps extends ComponentPropsWithoutRef<"div"> {}

export function Steps({ className, children, ...rest }: StepsProps) {
  return (
    <div className={cx("hds-steps", className)} {...rest}>
      {children}
    </div>
  )
}

export interface StepSkill {
  /** Chip text, rendered via `Chip` `variant="skill"`. */
  label: string
  /** Applies the harness-engineer tone accent to this skill's chip (`Chip`'s `tone="he"`). */
  he?: boolean
}

export interface StepProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Content of the rail node (typically a step index, e.g. `"01"`). */
  number?: ReactNode
  /** Step heading, shown at the top of the step's panel. */
  title?: ReactNode
  /** Skill chips rendered next to the title. */
  skills?: StepSkill[]
  /** Marks this step as the emphasized/current one: the rail node gets the brand accent fill instead of the neutral surface. */
  highlight?: boolean
  /** Set on the final step to omit the connecting wire below its rail node. */
  last?: boolean
}

export function Step({
  number,
  title,
  skills = [],
  highlight = false,
  last = false,
  className,
  children,
  ...rest
}: StepProps) {
  return (
    <div className={cx("hds-step", highlight && "hds-step-he", className)} {...rest}>
      <div className="hds-rail">
        <div className="hds-node cut-sm">{number}</div>
        {!last && <div className="hds-wire" aria-hidden="true" />}
      </div>
      <Panel className="hds-step-panel" hover="slide">
        <div className="hds-ph">
          <h3>{title}</h3>
          {skills.map((skill) => (
            <Chip key={skill.label} variant="skill" tone={skill.he ? "he" : undefined}>
              {skill.label}
            </Chip>
          ))}
        </div>
        {children}
      </Panel>
    </div>
  )
}

export interface SubstepsProps extends ComponentPropsWithoutRef<"div"> {}

export function Substeps({ className, children, ...rest }: SubstepsProps) {
  return (
    <div className={cx("hds-substeps", className)} {...rest}>
      {children}
    </div>
  )
}

export interface SubProps extends ComponentPropsWithoutRef<"div"> {
  /** Small leading label above the sub-step body (e.g. a sub-index). */
  label?: ReactNode
  /** Secondary label under `label` (e.g. a related skill/tool name). */
  skill?: ReactNode
}

export function Sub({ label, skill, className, children, ...rest }: SubProps) {
  return (
    <div className={cx("hds-sub", "cut-sm", className)} {...rest}>
      <div className="hds-sub-lbl">{label}</div>
      <div className="hds-sub-sk">{skill}</div>
      <p>{children}</p>
    </div>
  )
}
